import OpenAI from "openai";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_CANDIDATE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-lightning:free",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
  "openai/gpt-4o-mini",
];

const getHeaders = () => ({
  "HTTP-Referer": process.env.SITE_URL || process.env.CLIENT_URL || "https://serveq.tech",
  "X-Title": "ServeQ",
});

/**
 * Extracts and sanitizes all configured OpenRouter API keys from environment
 * Supports:
 * - OPENROUTER_API_KEY (single or comma/newline/semicolon separated)
 * - OPENROUTER_API_KEYS (comma/semicolon/newline separated list)
 * - OPENAI_API_KEY (standard OpenAI environment variable)
 * - OPENROUTER_KEY
 * - GEMINI_API_KEY (if user pasted an OpenRouter key there starting with sk-or-)
 */
export function getOpenRouterApiKeys() {
  const sources = [
    process.env.OPENROUTER_API_KEYS,
    process.env.OPENROUTER_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.OPENROUTER_KEY,
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith("sk-or-")
      ? process.env.GEMINI_API_KEY
      : null,
  ];

  const keys = [];
  for (const src of sources) {
    if (!src || typeof src !== "string") continue;
    const items = src.split(/[\r\n,;]+/).map((k) => k.trim().replace(/^['"]|['"]$/g, ""));
    for (const item of items) {
      if (
        item &&
        !keys.includes(item) &&
        !item.includes("your_") &&
        item !== "undefined" &&
        item !== "null"
      ) {
        keys.push(item);
      }
    }
  }
  return keys;
}

const clientCache = new Map();

/**
 * Get or create an OpenAI SDK instance configured for OpenRouter with a specific API key
 */
export function getOpenRouterClient(apiKey) {
  if (!apiKey) return null;
  if (clientCache.has(apiKey)) {
    return clientCache.get(apiKey);
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
    defaultHeaders: getHeaders(),
  });

  clientCache.set(apiKey, client);
  return client;
}

let keyRotationIndex = 0;

/**
 * Executes a chat completion through OpenRouter using the OpenAI SDK.
 * Runs across every available OpenRouter API key and candidate models.
 * If one key fails (rate limit, quota, invalid, timeout), it seamlessly tries the next key.
 */
export async function executeOpenRouterChat({
  messages,
  candidateModels = null,
  temperature = 0.3,
  maxTokens = 1000,
  responseFormat = null,
  reasoning = { effort: "none" },
  timeoutMs = 15000,
  extraKeys = [],
}) {
  const envKeys = getOpenRouterApiKeys();
  const allKeys = [
    ...new Set([...(Array.isArray(extraKeys) ? extraKeys : [extraKeys]), ...envKeys]),
  ].filter(Boolean);

  if (allKeys.length === 0) {
    return {
      success: false,
      error: "No OpenRouter API key found. Please configure OPENROUTER_API_KEY in .env",
    };
  }

  const configuredModel = process.env.OPENROUTER_MODEL;
  const models =
    candidateModels && candidateModels.length > 0
      ? configuredModel && !candidateModels.includes(configuredModel)
        ? [configuredModel, ...candidateModels]
        : candidateModels
      : configuredModel
      ? [configuredModel, ...DEFAULT_CANDIDATE_MODELS]
      : DEFAULT_CANDIDATE_MODELS;

  // Rotate starting key for load balancing across requests, while still testing EVERY key on error
  const startIndex = keyRotationIndex % allKeys.length;
  keyRotationIndex = (keyRotationIndex + 1) % allKeys.length;

  const orderedKeys = [...allKeys.slice(startIndex), ...allKeys.slice(0, startIndex)];

  const errors = [];

  for (let kIdx = 0; kIdx < orderedKeys.length; kIdx++) {
    const key = orderedKeys[kIdx];
    const maskedKey = key.length > 8 ? `${key.slice(0, 7)}...${key.slice(-4)}` : "***";
    const client = getOpenRouterClient(key);

    for (const model of models) {
      try {
        const payload = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        };

        if (responseFormat) {
          payload.response_format = responseFormat;
        }

        if (reasoning) {
          payload.reasoning = reasoning;
        }

        // Call OpenAI SDK with timeout protection
        const callPromise = client.chat.completions.create(payload);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        );

        const response = await Promise.race([callPromise, timeoutPromise]);
        const choice = response?.choices?.[0];
        const content = choice?.message?.content;

        if (content && content.trim()) {
          return {
            success: true,
            content: content.trim(),
            modelUsed: model,
            keyMasked: maskedKey,
            rawResponse: response,
          };
        }
      } catch (err) {
        const errMessage = err?.message || String(err);
        errors.push(`Key ${maskedKey} with model ${model}: ${errMessage}`);
        console.warn(`[OpenRouter] Call failed (Key: ${maskedKey}, Model: ${model}): ${errMessage}`);

        // If error indicates optional parameter not supported (response_format or reasoning), retry with clean payload
        if (
          (responseFormat || reasoning) &&
          (errMessage.includes("response_format") ||
            errMessage.includes("reasoning") ||
            errMessage.includes("json_object") ||
            err?.status === 400)
        ) {
          try {
            const retryPayload = {
              model,
              messages,
              temperature,
              max_tokens: maxTokens,
            };
            const retryCall = client.chat.completions.create(retryPayload);
            const retryTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
            );
            const retryRes = await Promise.race([retryCall, retryTimeout]);
            const retryContent = retryRes?.choices?.[0]?.message?.content;
            if (retryContent && retryContent.trim()) {
              return {
                success: true,
                content: retryContent.trim(),
                modelUsed: model,
                keyMasked: maskedKey,
                rawResponse: retryRes,
              };
            }
          } catch (retryErr) {
            console.warn(
              `[OpenRouter] Clean retry also failed: ${retryErr.message}`
            );
          }
        }
      }
    }
  }

  return {
    success: false,
    error: `All OpenRouter keys and models failed. Details: ${errors.slice(-3).join("; ")}`,
  };
}

