/**
 * Server-side env validation via `@t3-oss/env-nextjs`. The build will
 * fail loudly if a required key is missing — better than a vague runtime
 * error when the chat route tries to call Claude.
 *
 * Only two server vars matter:
 *   - `DATABASE_URL`      Neon pooled connection string
 *   - `ANTHROPIC_API_KEY` Anthropic key (set a spend cap before deploy)
 *
 * Import the validated env as `import { env } from "~/env"`.
 */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
