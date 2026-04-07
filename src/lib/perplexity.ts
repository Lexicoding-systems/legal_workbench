/**
 * Perplexity API client.
 *
 * Perplexity uses an OpenAI-compatible chat completions API.
 * We use sonar-pro for web-grounded answers with inline citations.
 */

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export interface PerplexityResult {
  answer: string;
  citations: string[]; // URLs returned in the response
  model: string;
}

export interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function queryPerplexity(
  messages: PerplexityMessage[],
  model = "sonar-pro"
): Promise<PerplexityResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PERPLEXITY_API_KEY is not set. Add it to .env and restart the server."
    );
  }

  const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      // Return citations in the response
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Perplexity API error ${response.status}: ${errText.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("Perplexity returned no choices in response");
  }

  return {
    answer: choice.message?.content ?? "",
    citations: data.citations ?? [],
    model: data.model ?? model,
  };
}
