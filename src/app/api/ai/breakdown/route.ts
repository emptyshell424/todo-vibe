import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

type BreakdownTask = {
  title: string;
  priority: 'high' | 'medium' | 'low';
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type ErrorWithStatus = {
  status?: number;
  response?: {
    status?: number;
  };
  message?: string;
};

const proxyUrl = (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim();

if (proxyUrl) {
  try {
    console.log(`[AI Breakdown] Configuring proxy: ${proxyUrl}`);
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch (error) {
    console.error('[AI Breakdown] Failed to set global dispatcher:', error);
  }
}

const responseSchema: Schema = {
  description: 'List of breakdown tasks',
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      title: {
        type: SchemaType.STRING,
        description: 'A concrete and actionable task title',
      },
      priority: {
        type: SchemaType.STRING,
        format: 'enum',
        description: 'Task priority',
        enum: ['high', 'medium', 'low'],
      },
    },
    required: ['title', 'priority'],
  },
} as const;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as ErrorWithStatus;
  return candidate.status || candidate.response?.status;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && typeof (error as ErrorWithStatus).message === 'string') {
    return (error as ErrorWithStatus).message ?? '';
  }

  return '';
}

function extractArrayFromObject(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return Object.values(value as Record<string, unknown>).find((item) => Array.isArray(item)) ?? null;
}

function cleanJsonResponse(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : extractArrayFromObject(parsed);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
      return null;
    }

    try {
      const parsed = JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
      return extractArrayFromObject(parsed);
    } catch {
      return null;
    }
  }
}

function isValidTaskArray(value: unknown): value is BreakdownTask[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const candidate = item as BreakdownTask;
      return (
        typeof candidate.title === 'string' &&
        candidate.title.trim().length > 0 &&
        ['high', 'medium', 'low'].includes(candidate.priority)
      );
    })
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const goal = typeof body?.goal === 'string' ? body.goal.trim() : '';
    const clientApiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const provider = body?.provider === 'openai' ? 'openai' : 'gemini';
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const customModel = typeof body?.model === 'string' ? body.model.trim() : '';

    if (!goal) {
      return jsonError(400, 'invalid_goal', '请输入要拆解的目标。');
    }

    const activeApiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return jsonError(401, 'missing_api_key', '未检测到 API Key。请先在设置中配置 API Key。');
    }

    let parsed: unknown = null;

    if (provider === 'openai') {
      const apiBase = baseUrl || 'https://api.openai.com/v1';
      const modelName = customModel || 'gpt-4o-mini';

      const response = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeApiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content:
                '你是专业的任务拆解助手。请把用户的大目标拆解为 4 个具体、清晰、可立即执行的小任务。输出必须是 JSON 数组，例如：[{"title":"任务1","priority":"high"}]。',
            },
            { role: 'user', content: `用户目标：${goal}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API request failed: ${errorText}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      parsed = cleanJsonResponse(data.choices?.[0]?.message?.content ?? '');
    } else {
      const genAI = new GoogleGenerativeAI(activeApiKey);
      const modelName = customModel || (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
      const model = genAI.getGenerativeModel(
        {
          model: modelName,
          systemInstruction:
            '你是专业的任务拆解助手。请把用户的大目标拆解为 4 个具体、清晰、可立即执行的小任务，并严格输出 JSON 数组。',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        },
        { apiVersion: 'v1beta' }
      );

      const prompt = [
        `用户目标：${goal}`,
        '请输出 4 个任务。',
        '每个任务都必须包含 title 和 priority。',
        'priority 只能是 "high"、"medium"、"low" 之一。',
        '不要输出 Markdown，不要输出额外解释。',
      ].join('\n');

      const result = await model.generateContent(prompt);
      const response = await result.response;
      parsed = cleanJsonResponse(response.text());
    }

    if (!isValidTaskArray(parsed)) {
      return jsonError(502, 'invalid_ai_response', 'AI 返回的数据格式不正确，请稍后重试。');
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = getErrorMessage(error) || 'Unknown error';
    const status = getErrorStatus(error) || 500;

    console.error('[AI Breakdown] Route failed:', error);

    if (status === 503 || message.includes('503') || message.includes('Service Unavailable')) {
      return jsonError(503, 'provider_unavailable', 'AI 服务当前不可用，请稍后重试。');
    }

    if (message.includes('API key not valid') || status === 401) {
      return jsonError(401, 'invalid_api_key', 'API Key 无效，请检查设置。');
    }

    if (status === 404 || message.includes('is not found') || message.includes('Model not found')) {
      return jsonError(404, 'model_not_found', `配置的模型 ${process.env.GEMINI_MODEL || '当前模型'} 不可用，请检查模型设置。`);
    }

    if (message.includes('fetch failed')) {
      return jsonError(502, 'network_unreachable', '服务端无法连接 AI API，请检查网络或代理配置。');
    }

    if (message.includes('User location is not supported') || status === 403) {
      return jsonError(403, 'region_unsupported', '当前地区不受支持，请切换到受支持的服务端网络环境。');
    }

    if (message.includes('quota') || status === 429) {
      return jsonError(429, 'quota_exceeded', 'API 配额已用尽或请求过于频繁，请稍后再试。');
    }

    return jsonError(500, 'ai_request_failed', 'AI 拆解失败，请稍后重试。');
  }
}
