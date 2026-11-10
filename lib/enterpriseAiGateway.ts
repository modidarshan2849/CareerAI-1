import { GoogleGenAI } from "@google/genai";

export interface GatewayRequest {
  systemPrompt?: string;
  userPrompt: string;
  responseMimeType?: "application/json" | "text/plain";
}

// 1. Primary: Google Gemini 3.8 Flash with 3-Stage Jittered Backoff
async function callGemini(req: GatewayRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "build-key-fallback") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const fullContent = req.systemPrompt ? `${req.systemPrompt}\n\n${req.userPrompt}` : req.userPrompt;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: fullContent,
        config: req.responseMimeType === "application/json" ? { responseMimeType: "application/json" } : undefined,
      });

      if (!res?.text) throw new Error("Empty response returned from gemini-3.8-flash");
      return res.text;
    } catch (err: any) {
      const is503 =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.message?.includes("503") ||
        err?.message?.includes("high demand") ||
        err?.message?.includes("UNAVAILABLE");

      if (is503 && attempt < maxRetries) {
        // Exponential backoff with jitter: ~1.5s, ~3.0s
        const delay = attempt * 1500 + Math.floor(Math.random() * 500);
        console.warn(`[Enterprise Gateway] gemini-3.8-flash 503 high demand. Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw new Error("gemini-3.8-flash failed after retries.");
}

// 2. Secondary Hot Standby: OpenAI GPT-4o-mini (Native HTTP Fetch)
async function callOpenAI(req: GatewayRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
  messages.push({ role: "user", content: req.userPrompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      response_format: req.responseMimeType === "application/json" ? { type: "json_object" } : undefined,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response body");
  return text;
}

// 3. Resilient Multi-Tier Router
export async function executeEnterpriseAiJob(req: GatewayRequest): Promise<string> {
  // Attempt Primary: Gemini 3.8 Flash
  try {
    return await callGemini(req);
  } catch (geminiError: any) {
    console.warn("[Enterprise Gateway] Gemini cluster exhausted or failed:", geminiError?.message || geminiError);

    // Attempt Secondary Hot Standby if key is present
    if (process.env.OPENAI_API_KEY) {
      console.info("[Enterprise Gateway] Switching seamlessly to OpenAI GPT-4o-mini fallback...");
      try {
        return await callOpenAI(req);
      } catch (openAiError: any) {
        throw new Error(`Dual-provider failure. Gemini Error: ${geminiError?.message} | OpenAI Error: ${openAiError?.message}`);
      }
    }

    throw new Error(`Gemini service capacity issue: ${geminiError?.message || "Model unavailable"}. Please retry in 5 seconds or configure OPENAI_API_KEY as hot standby.`);
  }
}
