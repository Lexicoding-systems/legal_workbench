/**
 * Robustly extracts a JSON value from a model response string.
 *
 * Claude sometimes wraps JSON in markdown fences (```json ... ```) even when
 * instructed not to, or prepends explanatory text. This utility handles all
 * common cases so generators never crash on formatting quirks.
 *
 * Attempts in order:
 *  1. Direct JSON.parse (happy path — no overhead)
 *  2. Strip ```json ... ``` or ``` ... ``` fences
 *  3. Find the first [ or { and parse from there
 *  4. Throw with context so the caller can log and surface a clear error
 */
export function extractJson(raw: string): unknown {
  // 1. Direct parse
  try {
    return JSON.parse(raw);
  } catch {}

  // 2. Markdown fence stripping
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }

  // 3. Find first JSON structure character and parse from there
  const start = raw.search(/[{[]/);
  if (start !== -1) {
    try {
      return JSON.parse(raw.slice(start));
    } catch {}
  }

  // 4. Give up — include a preview so the caller can log something useful
  throw new Error(
    `Could not parse JSON from model response. Preview: ${raw.slice(0, 300)}`
  );
}
