import {z} from "zod";

// Mirror the CHECK constraints in supabase/migrations. If one changes, change both.
export const TIERS = ["close", "warm", "weak"] as const;
export const LANGUAGES = ["en", "es"] as const;
export const INTERACTION_KINDS = ["meeting", "email", "call", "message"] as const;
export const INTERACTION_SOURCES = ["google_calendar", "manual", "csv"] as const;

export const TierSchema = z.enum(TIERS);
export const LanguageSchema = z.enum(LANGUAGES);
export const InteractionKindSchema = z.enum(INTERACTION_KINDS);
export const InteractionSourceSchema = z.enum(INTERACTION_SOURCES);

export type Tier = z.infer<typeof TierSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type InteractionKind = z.infer<typeof InteractionKindSchema>;
export type InteractionSource = z.infer<typeof InteractionSourceSchema>;

// The DB requires email = lower(email), so normalize before validating.
const EmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const NewContactSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  email: EmailSchema.nullish(),
  company: z.string().trim().max(200).nullish(),
  preferred_language: LanguageSchema.default("en"),
  tier: TierSchema.default("warm"),
  notes: z.string().trim().max(2000).nullish(),
});
export type NewContact = z.infer<typeof NewContactSchema>;

export const NewInteractionSchema = z
  .object({
    contact_id: z.uuid(),
    kind: InteractionKindSchema,
    occurred_at: z.iso.datetime({ offset: true }),
    source: InteractionSourceSchema,
    external_id: z.string().min(1).nullish(),
    summary: z.string().trim().max(1000).nullish(),
  })
  // Mirrors the DB check: calendar rows need an external_id so sync stays idempotent.
  .refine((i) => i.source !== "google_calendar" || Boolean(i.external_id), {
    message: "external_id is required for google_calendar interactions",
    path: ["external_id"],
  });
export type NewInteraction = z.infer<typeof NewInteractionSchema>;