import "server-only";
import {z} from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
});

const anthropicSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1),
});

export function serverEnv() {
  return schema.parse(process.env);
}

export function anthropicEnv() {
  return anthropicSchema.parse(process.env);
}