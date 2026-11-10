import { GoogleGenAI } from "@google/genai";

const CONFIRMED_MODELS = ["gemini-3.8-flash"];

interface GenerateOptions {
  contents: string;
  responseMimeType?: string;
  maxRetries?: number;
}

export async function generateContentWithRetry({
  contents,
  responseMimeType,
  maxRetries = 2,
}: GenerateOptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "build-key-fallback") {
    throw new Error("GEMINI_API_KEY is not configured in .env.local");
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  for (const model of CONFIRMED_MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: responseMimeType ? { responseMimeType } : undefined,
        });

        if (response?.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const isTransient =
          err?.status === 503 ||
          err?.code === 503 ||
          err?.message?.includes("503") ||
          err?.message?.includes("high demand") ||
          err?.message?.includes("UNAVAILABLE");

        if (isTransient && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          continue;
        }

        // Move to the next confirmed model in the pool immediately if 503 persists
        break;
      }
    }
  }

  throw lastError || new Error("All configured Gemini models failed.");
}
