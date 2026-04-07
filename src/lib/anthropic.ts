import Anthropic from "@anthropic-ai/sdk";

// Fail loudly at startup rather than producing a cryptic 401 on first generation attempt.
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Add it to .env and restart the server."
  );
}

const globalForAnthropic = globalThis as unknown as {
  anthropic?: Anthropic;
};

export const anthropic: Anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}
