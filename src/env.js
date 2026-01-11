import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // JWT Secret (minimum 32 characters)
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    // Email Service (Optional - for production)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Story 4.1: AI Classification Configuration
    AI_PROVIDER: z
      .enum(["upstage", "openai", "anthropic"])
      .default("upstage"),
    UPSTAGE_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    // Story 4.1: AI Classification
    AI_PROVIDER: process.env.AI_PROVIDER,
    UPSTAGE_API_KEY: process.env.UPSTAGE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

/**
 * Story 4.1: AI Provider Validation
 * Validates that the correct API key is set based on the selected AI provider.
 * This runs after the initial env validation to ensure provider-specific keys are present.
 */
export function validateAIProviderConfig() {
  // Skip validation if explicitly set
  if (process.env.SKIP_ENV_VALIDATION) {
    console.warn("⚠️  Skipping AI provider validation (SKIP_ENV_VALIDATION is set)");
    return;
  }

  const provider = env.AI_PROVIDER;

  switch (provider) {
    case "upstage":
      if (!env.UPSTAGE_API_KEY) {
        throw new Error(
          "❌ Invalid environment variables: UPSTAGE_API_KEY is required when AI_PROVIDER=upstage\n" +
            'Set UPSTAGE_API_KEY in your .env file. Get your key from: https://console.upstage.ai'
        );
      }
      break;
    case "openai":
      if (!env.OPENAI_API_KEY) {
        throw new Error(
          "❌ Invalid environment variables: OPENAI_API_KEY is required when AI_PROVIDER=openai\n" +
            'Set OPENAI_API_KEY in your .env file. Get your key from: https://platform.openai.com/api-keys'
        );
      }
      break;
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error(
          "❌ Invalid environment variables: ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic\n" +
            'Set ANTHROPIC_API_KEY in your .env file. Get your key from: https://console.anthropic.com'
        );
      }
      break;
    default:
      // This should never happen due to Zod enum validation
      throw new Error(`❌ Invalid AI_PROVIDER: ${provider}`);
  }
}

// Auto-validate on import (in development/production, not test)
if (env.NODE_ENV !== "test") {
  try {
    validateAIProviderConfig();
  } catch (error) {
    // Only log the error, don't throw to allow the app to start
    // The actual validation will happen when the classification service is used
    console.error(error);
  }
}
