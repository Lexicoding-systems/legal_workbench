/**
 * Provider-agnostic AI text generation.
 *
 * Priority: GROQ_API_KEY → ANTHROPIC_API_KEY
 * Set whichever key you have in .env — the app uses it automatically.
 *
 * Free options:
 *   Groq  — console.groq.com   (free tier, no credit card)
 *   Anthropic — console.anthropic.com (paid)
 */

import OpenAI from "openai";
import { GROQ_MODEL, ANTHROPIC_MODEL, AI_TIMEOUT_MS } from "@/config/constants";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timer)).then(
    (v) => v,
    (err) => {
      if (controller.signal.aborted) {
        throw new Error(`AI call timed out after ${ms}ms [${label}]`);
      }
      throw err;
    }
  );
}

// Groq uses the OpenAI SDK pointed at their base URL
function getGroqClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

async function callGroq(messages: AIMessage[], maxTokens: number): Promise<AIResponse> {
  const client = getGroqClient();
  const model = GROQ_MODEL;
  const completion = await withTimeout(
    client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      // Groq supports response_format for JSON mode
      response_format: { type: "json_object" },
    }),
    AI_TIMEOUT_MS,
    "groq"
  );
  return {
    text: completion.choices[0]?.message?.content ?? "",
    provider: "groq",
    model,
  };
}

async function callAnthropic(messages: AIMessage[], maxTokens: number): Promise<AIResponse> {
  // Dynamic import so the module doesn't crash if @anthropic-ai/sdk isn't installed
  const { anthropic } = await import("@/lib/anthropic");
  const model = ANTHROPIC_MODEL;

  // Split system message from user/assistant messages
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const response = await withTimeout(
    anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemMsg,
      messages: chatMessages,
    }),
    AI_TIMEOUT_MS,
    "anthropic"
  );

  return {
    text: response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join(""),
    provider: "anthropic",
    model,
  };
}

/**
 * Generate text from a list of messages.
 * Automatically picks the available provider based on env keys.
 */
export async function generateText(
  messages: AIMessage[],
  maxTokens = 4096
): Promise<AIResponse> {
  if (process.env.GROQ_API_KEY) {
    return callGroq(messages, maxTokens);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(messages, maxTokens);
  }
  throw new Error(
    "No AI provider configured. Set GROQ_API_KEY (free at console.groq.com) " +
    "or ANTHROPIC_API_KEY in .env."
  );
}
