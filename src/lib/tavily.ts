/**
 * Tavily search client — free tier at tavily.com (1000 searches/month, no credit card).
 *
 * Tavily returns AI-synthesized answers with source URLs, similar to Perplexity
 * but with a generous free tier suited for individual use.
 */

export interface TavilyResult {
  answer: string;
  citations: string[];
  model: string;
}

export async function queryTavily(
  query: string,
  searchDepth: "basic" | "advanced" = "advanced"
): Promise<TavilyResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not set. Get a free key at tavily.com and add it to .env."
    );
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      include_answer: true,
      include_raw_content: false,
      max_results: 8,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Tavily API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const citations: string[] = (data.results ?? []).map((r: any) => r.url).filter(Boolean);

  return {
    answer: data.answer ?? "No answer returned.",
    citations,
    model: "tavily",
  };
}
