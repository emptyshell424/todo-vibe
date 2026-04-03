import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  "http://127.0.0.1:7897";

setGlobalDispatcher(new ProxyAgent(proxyUrl));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type BreakdownTask = {
  title: string;
  priority: "high" | "medium" | "low";
};

const responseSchema: any = {
  description: "List of breakdown tasks",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      title: {
        type: SchemaType.STRING,
        description: "A concrete and actionable task title",
      },
      priority: {
        type: SchemaType.STRING,
        description: "Task priority",
        enum: ["high", "medium", "low"],
      },
    },
    required: ["title", "priority"],
  },
};

function cleanJsonResponse(text: string) {
  const cleaned = text.replace(/```json|```/gi, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function isValidTaskArray(value: unknown): value is BreakdownTask[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as BreakdownTask).title === "string" &&
        (item as BreakdownTask).title.trim().length > 0 &&
        ["high", "medium", "low"].includes((item as BreakdownTask).priority)
    )
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";

    if (!goal) {
      return NextResponse.json({ error: "请输入要拆解的目标" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "服务端未配置 Gemini API Key" }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction:
        "你是一名专业的任务拆解助手。请把用户的大目标拆解为 4 个具体、清晰、可立即执行的小任务，并严格输出 JSON 数组。",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const prompt = [
      `用户目标：${goal}`,
      "请输出 4 个任务。",
      "每个任务都必须包含 title 和 priority。",
      'priority 只能是 "high"、"medium"、"low" 之一。',
      "不要输出 Markdown，不要输出额外解释。",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsed = cleanJsonResponse(text);

    if (!isValidTaskArray(parsed)) {
      console.error("Invalid Gemini response payload:", text);
      return NextResponse.json(
        { error: "AI 返回的数据格式不正确，请稍后重试" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AI breakdown route failed:", error);

    if (message.includes("API key not valid")) {
      return NextResponse.json({ error: "Gemini API Key 无效，请检查配置" }, { status: 500 });
    }

    if (message.includes("is not found for API version")) {
      return NextResponse.json(
        { error: "当前配置的 Gemini 模型不可用，请改用 gemini-2.5-flash" },
        { status: 500 }
      );
    }

    if (message.includes("fetch failed")) {
      return NextResponse.json(
        {
          error:
            "服务端当前无法连接 Gemini API，请检查 Clash 规则是否让 generativelanguage.googleapis.com 走代理",
        },
        { status: 502 }
      );
    }

    if (message.toLowerCase().includes("deadline")) {
      return NextResponse.json({ error: "Gemini 响应超时，请稍后再试" }, { status: 504 });
    }

    return NextResponse.json({ error: "AI 拆解服务暂时不可用" }, { status: 500 });
  }
}
