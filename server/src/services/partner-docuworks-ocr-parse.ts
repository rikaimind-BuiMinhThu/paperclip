export function confidenceBand(score: number): "High" | "Medium" | "Low" {
  if (score >= 0.85) return "High";
  if (score >= 0.65) return "Medium";
  return "Low";
}

export function parseOcrJsonFromText(body: string): {
  text: string;
  confidence_score: number;
  confidence?: string;
} | null {
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? body).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    const text = typeof parsed.text === "string" ? parsed.text : null;
    const scoreRaw = parsed.confidence_score;
    const score =
      typeof scoreRaw === "number"
        ? scoreRaw
        : typeof scoreRaw === "string"
          ? Number(scoreRaw)
          : NaN;
    if (text == null || !Number.isFinite(score)) return null;
    return {
      text,
      confidence_score: Math.min(1, Math.max(0, score)),
      confidence: typeof parsed.confidence === "string" ? parsed.confidence : undefined,
    };
  } catch {
    return null;
  }
}
