import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { ProxyAgent, setGlobalDispatcher } from "undici";

// Proxy configuration
const proxyUrl = (
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  "http://127.0.0.1:7897"
).trim();

try {
  console.log(`[AI Breakdown] Configuring proxy: ${proxyUrl}`);
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
} catch (e) {
  console.error("[AI Breakdown] Failed to set global dispatcher:", e);
}

// We will initialize genAI inside the POST handler to use dynamic keys
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

type BreakdownTask = {
  title: string;
  priority: "high" | "medium" | "low";
};

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
  console.log("[AI Breakdown] Received request");
  try {
    const body = await req.json().catch(() => null);
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
    const clientApiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const provider = body?.provider || "gemini";
    const baseUrl = body?.baseUrl?.trim();
    const customModel = body?.model?.trim();

    if (!goal) {
      return NextResponse.json({ error: "请输入要拆解的目标" }, { status: 400 });
    }

    // Strictly prioritize and ONLY use the client-provided API key for isolation
    const activeApiKey = clientApiKey;

    if (!activeApiKey) {
      console.error("[AI Breakdown] Client API Key is missing");
      return NextResponse.json(
        { error: "未检测到 API Key。为了保护隐私和资源隔离，请在“设置”中配置您自己的 API Key 以后使用此功能。" }, 
        { status: 401 }
      );
    }

    let parsed: any = null;

    if (provider === "openai") {
      const apiBase = baseUrl || "https://api.openai.com/v1";
      const modelName = customModel || "gpt-3.5-turbo";
      console.log(`[AI Breakdown] Using OpenAI format. Provider: ${apiBase}, Model: ${modelName}`);

      const response = await fetch(`${apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeApiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { 
              role: "system", 
              content: "你是一名专业的任务拆解助手。请把用户的大目标拆解为 4 个具体、清晰、可立即执行的小任务。系统将解析你的输出为 JSON 数组。格式必须为：[{\"title\": \"任务1\", \"priority\": \"high\"}, ...]" 
            },
            { role: "user", content: `用户目标：${goal}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API request failed: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      parsed = cleanJsonResponse(content);
    } else {
      const genAI = new GoogleGenerativeAI(activeApiKey);
      const modelName = customModel || (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
      console.log(`[AI Breakdown] Using Gemini SDK. Model: ${modelName}`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction:
          "你是一名专业的任务拆解助手。请把用户的大目标拆解为 4 个具体、清晰、可立即执行的小任务，并严格输出 JSON 数组。",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
        },
      }, { apiVersion: 'v1beta' });

      const prompt = [
        `用户目标：${goal}`,
        "请输出 4 个任务。",
        "每个任务都必须包含 title 和 priority。",
        'priority 只能是 "high"、"medium"、"low" 之一。',
        "不要输出 Markdown，不要输出额外解释。",
      ].join("\n");

      let result;
      let retryCount = 0;
      const maxRetries = 1;

      while (retryCount <= maxRetries) {
        try {
          console.log(`[AI Breakdown] Generating content (attempt ${retryCount + 1})...`);
          result = await model.generateContent(prompt);
          break;
        } catch (err: any) {
          console.error(`[AI Breakdown] Attempt ${retryCount + 1} failed:`, err);
          const status = err?.status || err?.response?.status;
          const message = err?.message || "";

          if (retryCount < maxRetries && (status === 503 || message.includes('503'))) {
            retryCount++;
            console.log("[AI Breakdown] Retrying in 1s...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw err;
        }
      }

      if (!result) throw new Error("AI generation failed or returned no result");

      const response = await result.response;
      parsed = cleanJsonResponse(response.text());
    }

    if (!isValidTaskArray(parsed)) {
      console.error("[AI Breakdown] Invalid AI response payload:", parsed);
      return NextResponse.json(
        { error: "AI 返回的数据格式不正确，请稍后重试" },
        { status: 502 }
      );
    }

    console.log("[AI Breakdown] Successfully parsed tasks");
    return NextResponse.json(parsed);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error?.status || error?.response?.status || 500;
    
    console.error("[AI Breakdown] Route failed:", error);

    // Specific error mapping
    if (status === 503 || message.includes("503") || message.includes("Service Unavailable")) {
      return NextResponse.json(
        { error: "Gemini 服务当前不可用 (503 Service Unavailable)，请检查代理是否正常运行 (7897)" },
        { status: 503 }
      );
    }

    if (message.includes("API key not valid") || status === 401) {
      return NextResponse.json({ error: "Gemini API Key 无效，请检查 .env.local 配置" }, { status: 401 });
    }

    if (status === 404 || message.includes("is not found") || message.includes("Model not found")) {
      return NextResponse.json(
        { error: `配置的模型 ${process.env.GEMINI_MODEL} 不可用，建议设置为 gemini-1.5-flash` },
        { status: 404 }
      );
    }

    if (message.includes("fetch failed")) {
      return NextResponse.json(
        {
          error:
            "服务端无法连接 Gemini API，请确保 Clash 代理已开启并允许 generativelanguage.googleapis.com",
        },
        { status: 502 }
      );
    }

    if (message.includes("User location is not supported") || status === 403) {
      return NextResponse.json(
        { error: "当前地区不受支持，请切换代理至支持的地区 (如新加坡、美国)" },
        { status: 403 }
      );
    }
    
    if (message.includes("quota") || status === 429) {
      return NextResponse.json(
        { error: "Gemini API 额度已用完或请求太频繁，请稍后再试" },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: `AI 拆解失败: ${message}` }, { status: 500 });
  }
}
