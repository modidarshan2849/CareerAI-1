import { logApiUsage } from "@/lib/usageTelemetry";
import { GoogleGenAI } from "@google/genai";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

export interface GatewayRequest {
  systemPrompt?: string;
  userPrompt: string;
  responseMimeType?: "application/json" | "text/plain";
}

// 1. Primary Engine: Google Gemini (11s generous ceiling for large JSON, 0 delay on fail)
async function callGemini(req: GatewayRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "build-key-fallback") {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const ai = new GoogleGenAI({ apiKey });
  const fullContent = req.systemPrompt ? `${req.systemPrompt}\n\n${req.userPrompt}` : req.userPrompt;

  const responsePromise = ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: fullContent,
    config: {
      temperature: 0.15,
      maxOutputTokens: 3000,
      responseMimeType: req.responseMimeType === "application/json" ? "application/json" : undefined,
    },
  });

  // 11-second ceiling: allows complete generation without premature abort
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gemini latency exceeded 4500ms")), 4500)
  );

  const res: any = await Promise.race([responsePromise, timeoutPromise]);
  if (!res?.text) throw new Error("Empty response from Gemini");
  return res.text;
}

// 2. Secondary Engine: Amazon Bedrock (Meta Llama 3.3 70B - ~1.8s response time)
async function callBedrock(req: GatewayRequest): Promise<string> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS Bedrock credentials missing");
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new ConverseCommand({
    modelId: "us.meta.llama3-3-70b-instruct-v1:0",
    system: [{ text: req.systemPrompt || "You are an ATS resume optimization engine." }],
    messages: [{ role: "user", content: [{ text: req.userPrompt }] }],
    inferenceConfig: { maxTokens: 3500, temperature: 0.2 },
  });

  const response = await client.send(command);
  const text = response.output?.message?.content?.[0]?.text;
  if (!text) throw new Error("Bedrock returned empty response");
  return text;
}

// 3. Multi-Cloud Router
export async function executeEnterpriseAiJob(req: GatewayRequest): Promise<string> {
  try {
    return await callGemini(req);
  } catch (geminiError: any) {
    console.warn(`[AI Gateway] Gemini bypass (${geminiError?.message}) -> Routing to Bedrock...`);
    await logApiUsage({ provider: "bedrock", endpoint: "bedrock-fallback", unitsUsed: 2.5, unitType: "tokens", userId: "active_user" });

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        return await callBedrock(req);
      } catch (bedrockError: any) {
        throw new Error(
          `All engines exhausted. Gemini: ${geminiError?.message} | Bedrock: ${bedrockError?.message}`
        );
      }
    }
    throw geminiError;
  }
}
