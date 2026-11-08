import test from "node:test";
import assert from "node:assert/strict";

import {
  getOpenRouterApiKeys,
  getOpenRouterClient,
  executeOpenRouterChat,
  OPENROUTER_BASE_URL,
} from "../ai/openrouter.client.js";
import { generateBusinessAIAnalytics, predictServiceTime } from "../ai/openai.service.js";
import {
  generateBusinessAIAnalytics as legacyAnalytics,
  predictServiceTime as legacyPredict,
} from "../ai/gemini.service.js";
import { processMessage } from "../src/modules/chatbot/chatbot.service.js";

test("OpenRouter & OpenAI SDK Client Architecture", async (t) => {
  await t.test("getOpenRouterClient configures OpenAI SDK with OpenRouter base URL and headers", () => {
    const testKey = "sk-or-v1-testkey123456789";
    const client = getOpenRouterClient(testKey);

    assert.ok(client, "Client should be instantiated");
    assert.equal(client.apiKey, testKey, "API key should match");
    assert.equal(client.baseURL, OPENROUTER_BASE_URL, "Base URL should point to OpenRouter");
    assert.equal(client.baseURL, "https://openrouter.ai/api/v1");

    // Client should be cached per key
    const clientAgain = getOpenRouterClient(testKey);
    assert.equal(client, clientAgain, "Should return cached OpenAI client instance for identical key");
  });

  await t.test("getOpenRouterApiKeys extracts and sanitizes single and multi-keys correctly", () => {
    const savedKeys = process.env.OPENROUTER_API_KEYS;
    const savedKey = process.env.OPENROUTER_API_KEY;
    const savedOpenAI = process.env.OPENAI_API_KEY;
    const savedGemini = process.env.GEMINI_API_KEY;

    try {
      process.env.OPENROUTER_API_KEY = "sk-or-v1-keyA, sk-or-v1-keyB; 'sk-or-v1-keyC'";
      process.env.OPENROUTER_API_KEYS = "sk-or-v1-keyD\nsk-or-v1-keyE";
      process.env.OPENAI_API_KEY = "sk-or-v1-keyA"; // duplicate
      process.env.GEMINI_API_KEY = "your_gemini_api_key_here"; // placeholder to be filtered

      const keys = getOpenRouterApiKeys();
      assert.ok(keys.includes("sk-or-v1-keyA"));
      assert.ok(keys.includes("sk-or-v1-keyB"));
      assert.ok(keys.includes("sk-or-v1-keyC"));
      assert.ok(keys.includes("sk-or-v1-keyD"));
      assert.ok(keys.includes("sk-or-v1-keyE"));
      assert.ok(!keys.includes("your_gemini_api_key_here"));
      // Check deduplication
      const occurrences = keys.filter((k) => k === "sk-or-v1-keyA").length;
      assert.equal(occurrences, 1);
    } finally {
      process.env.OPENROUTER_API_KEYS = savedKeys;
      process.env.OPENROUTER_API_KEY = savedKey;
      process.env.OPENAI_API_KEY = savedOpenAI;
      process.env.GEMINI_API_KEY = savedGemini;
    }
  });

  await t.test("executeOpenRouterChat tries EVERY key and falls back seamlessly when first key fails", async () => {
    const key1 = "sk-or-v1-failingkey0001";
    const key2 = "sk-or-v1-workingkey0002";

    const client1 = getOpenRouterClient(key1);
    const client2 = getOpenRouterClient(key2);

    // Mock client1 to fail with rate limit / 429
    let client1Called = false;
    client1.chat = {
      completions: {
        create: async () => {
          client1Called = true;
          const err = new Error("Rate limit exceeded (429)");
          err.status = 429;
          throw err;
        },
      },
    };

    // Mock client2 to succeed
    let client2Called = false;
    client2.chat = {
      completions: {
        create: async ({ model, messages }) => {
          client2Called = true;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    reply: "Hello from OpenRouter backup key!",
                    model,
                  }),
                },
              },
            ],
          };
        },
      },
    };

    const result = await executeOpenRouterChat({
      messages: [{ role: "user", content: "Test prompt" }],
      extraKeys: [key1, key2],
      candidateModels: ["openai/gpt-4o-mini"],
      timeoutMs: 1000,
    });

    assert.ok(client1Called, "Should have attempted the first key");
    assert.ok(client2Called, "Should have fallen back to second key");
    assert.equal(result.success, true, "Chat call should succeed via second key");
    assert.ok(result.content.includes("Hello from OpenRouter backup key!"));
    assert.equal(result.modelUsed, "openai/gpt-4o-mini");
  });

  await t.test("executeOpenRouterChat reports graceful failure when all keys fail", async () => {
    const keyBad1 = "sk-or-v1-badkey001";
    const keyBad2 = "sk-or-v1-badkey002";

    const clientBad1 = getOpenRouterClient(keyBad1);
    const clientBad2 = getOpenRouterClient(keyBad2);

    clientBad1.chat = {
      completions: {
        create: async () => {
          throw new Error("Quota depleted (402)");
        },
      },
    };
    clientBad2.chat = {
      completions: {
        create: async () => {
          throw new Error("Unauthorized (401)");
        },
      },
    };

    const result = await executeOpenRouterChat({
      messages: [{ role: "user", content: "Test prompt" }],
      extraKeys: [keyBad1, keyBad2],
      candidateModels: ["openai/gpt-4o-mini"],
      timeoutMs: 1000,
    });

    assert.equal(result.success, false);
    assert.ok(result.error.includes("All OpenRouter keys and models failed"));
  });
});

test("AI Services & Compatibility Layer with OpenAI SDK / OpenRouter", async (t) => {
  await t.test("generateBusinessAIAnalytics delivers heuristic analytics when no API keys are present", async () => {
    const analytics = await generateBusinessAIAnalytics({
      businessName: "Downtown Barber Studio",
      category: "salon",
      bookingsCount: 25,
      cancellationCount: 3,
      averageRating: 4.9,
      recentReviews: [{ comment: "Best fade ever!", rating: 5 }],
      staffList: [{ name: "Marcus", role: "Master Barber", rating: 4.9 }],
    });

    assert.equal(analytics.isAiGenerated, false);
    assert.ok(Array.isArray(analytics.peakHours));
    assert.equal(analytics.cancellationRate, "12%");
    assert.equal(analytics.bestEmployee.name, "Marcus");
    assert.equal(analytics.bestEmployee.badge, "Barber of the Month");
    assert.ok(analytics.recommendations.length >= 3);
  });

  await t.test("legacy ai/gemini.service.js maintains exact backwards compatibility", async () => {
    const legacyRes = await legacyAnalytics({
      businessName: "City Care Clinic",
      category: "clinic",
      bookingsCount: 10,
      cancellationCount: 1,
      averageRating: 4.7,
    });

    assert.ok(legacyRes);
    assert.ok(legacyRes.peakHours.length > 0);
    assert.equal(legacyRes.bestEmployee.badge, "Top Doctor");

    const duration = await legacyPredict({
      serviceType: "clinic",
      userType: "normal",
      queueLength: 2,
      baseDuration: 20,
    });
    assert.ok(Number.isFinite(duration));
    assert.ok(duration >= 20);
  });

  await t.test("chatbot processMessage runs and returns intelligent deterministic response when offline", async () => {
    const res = await processMessage("What are your open appointment slots?", {});
    assert.ok(res.reply);
    assert.ok(res.intent);
    assert.equal(typeof res.reply, "string");
  });
});

