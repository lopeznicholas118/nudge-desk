import "server-only";
import {z} from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
});

export function serverEnv() {
  return schema.parse(process.env);
}