export interface FitScoreResult {
  fitScore: number;
  method: "vector" | "lexical_fallback";
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!apiKey || !clean) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: clean,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`Embeddings API HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  return json.data?.[0]?.embedding ?? null;
}

export function computeFitScore(params: {
  cosineSimilarity?: number | null;
  scenarioText: string;
  jobText: string;
}): FitScoreResult {
  if (typeof params.cosineSimilarity === "number" && Number.isFinite(params.cosineSimilarity)) {
    const clamped = Math.max(0, Math.min(1, params.cosineSimilarity));
    const scaled = Math.max(0, Math.min(100, ((clamped - 0.2) / 0.65) * 100));
    return {
      fitScore: Number(scaled.toFixed(1)),
      method: "vector",
    };
  }

  const scenarioTokens = new Set(
    params.scenarioText
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length >= 3)
  );
  const jobTokens = new Set(
    params.jobText
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length >= 3)
  );

  if (scenarioTokens.size === 0 || jobTokens.size === 0) {
    return { fitScore: 50, method: "lexical_fallback" };
  }

  let overlap = 0;
  for (const token of scenarioTokens) {
    if (jobTokens.has(token)) overlap += 1;
  }

  const ratio = overlap / Math.max(Math.min(scenarioTokens.size, 25), 1);
  const score = Math.min(98, Math.max(15, Number((ratio * 100).toFixed(1))));
  return { fitScore: score, method: "lexical_fallback" };
}
