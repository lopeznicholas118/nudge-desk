"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createAnthropicLlm, translateText} from "@nudge/agent";
import {
  applyTranslation,
  DraftBodySchema,
  LanguageSchema,
  planTranslation,
  type DraftText,
  type Language,
} from "@nudge/core";
import {requireUser} from "@/lib/auth";
import {anthropicEnv} from "@/lib/env.server";
import {describeError} from "@/lib/errors";

type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

const DRAFT_COLUMNS = "id, contact_id, language, body, alt_body, alt_language, status" as const;

/** Runs an action body, turns failures into a flash code, then reloads the dashboard. */
async function handle(run: () => Promise<string>): Promise<never> {
  let code: string;
  try {
    code = await run();
  } catch (err) {
    console.error("review action failed:", describeError(err));
    code = "failed";
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?flash=${code}`); // outside try/catch: redirect works by throwing
}

function readDraftForm(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("draft_id"));
  const body = DraftBodySchema.safeParse(formData.get("body"));
  return {id: id.success ? id.data : null, body: body.success ? body.data : null};
}

const asLanguage = (value: string | null): Language | null => {
  const parsed = LanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

async function loadPendingDraft(db: Db, userId: string, id: string) {
  const {data, error} = await db
    .from("drafts")
    .select(DRAFT_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return data;
}

type PendingDraft = NonNullable<Awaited<ReturnType<typeof loadPendingDraft>>>;

/** Persists an edit. A changed body invalidates the stored translation. */
async function saveBodyIfChanged(db: Db, userId: string, draft: PendingDraft, body: string) {
  if (body === draft.body) return draft;
  const {data, error} = await db
    .from("drafts")
    .update({ body, alt_body: null, alt_language: null })
    .eq("user_id", userId)
    .eq("id", draft.id)
    .eq("status", "pending")
    .select(DRAFT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDraft(formData: FormData) {
  const {supabase, user} = await requireUser();
  const {id, body} = readDraftForm(formData);

  return handle(async () => {
    if (!id) return "draft_missing";
    if (!body) return "draft_invalid";
    const draft = await loadPendingDraft(supabase, user.id, id);
    if (!draft) return "draft_missing";
    const saved = await saveBodyIfChanged(supabase, user.id, draft, body);
    return saved ? "draft_saved" : "draft_missing";
  });
}

export async function approveDraft(formData: FormData) {
  const {supabase, user} = await requireUser();
  const {id, body} = readDraftForm(formData);

  return handle(async () => {
    if (!id) return "draft_missing";
    if (!body) return "draft_invalid";
    // Saves whatever is in the textarea, so an unsaved edit is never lost on approval.
    const { data, error } = await supabase
      .from("drafts")
      .update({ body, status: "approved", approved_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    return data?.length === 1 ? "draft_approved" : "draft_missing";
  });
}

export async function discardDraft(formData: FormData) {
  const {supabase, user} = await requireUser();
  const id = z.uuid().safeParse(formData.get("draft_id"));

  return handle(async () => {
    if (!id.success) return "draft_missing";
    const { data, error } = await supabase
      .from("drafts")
      .update({ status: "discarded" })
      .eq("user_id", user.id)
      .eq("id", id.data)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    return data?.length === 1 ? "draft_discarded" : "draft_missing";
  });
}

export async function translateDraft(formData: FormData) {
  const {supabase, user} = await requireUser();
  const {id, body} = readDraftForm(formData);

  return handle(async () => {
    if (!id) return "draft_missing";
    if (!body) return "draft_invalid";

    let draft = await loadPendingDraft(supabase, user.id, id);
    if (!draft) return "draft_missing";
    draft = await saveBodyIfChanged(supabase, user.id, draft, body); // translate what's on screen
    if (!draft) return "draft_missing";

    const language = asLanguage(draft.language);
    if (!language) return "failed";
    // The button always means "show this in the other language".
    const target: Language = language === "en" ? "es" : "en";
    const current: DraftText = {
      language,
      body: draft.body,
      altBody: draft.alt_body,
      altLanguage: asLanguage(draft.alt_language),
    };

    const plan = planTranslation(current, target);
    if (plan.kind === "noop") return "draft_saved";

    let next: DraftText;
    if (plan.kind === "swap") {
      next = plan.next; // no LLM call
    } else {
      const env = anthropicEnv();
      const llm = createAnthropicLlm({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
      const translated = await translateText(llm, { text: current.body, from: plan.from, to: plan.to });
      next = applyTranslation(current, translated, plan.to);
    }

    const { data, error } = await supabase
      .from("drafts")
      .update({
        body: next.body,
        language: next.language,
        alt_body: next.altBody,
        alt_language: next.altLanguage,
      })
      .eq("user_id", user.id)
      .eq("id", draft.id)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    return data?.length === 1 ? "draft_translated" : "draft_missing";
  });
}

export async function markDraftSent(formData: FormData) {
  const {supabase} = await requireUser();
  const id = z.uuid().safeParse(formData.get("draft_id"));

  return handle(async () => {
    if (!id.success) return "draft_missing";
    const { error } = await supabase.rpc("mark_draft_sent", { p_draft_id: id.data });
    if (error?.code === "P0002") return "draft_missing";
    if (error) throw error;
    return "draft_sent";
  });
}

export async function dismissNudge(formData: FormData) {
  const {supabase, user} = await requireUser();
  const id = z.uuid().safeParse(formData.get("nudge_id"));

  return handle(async () => {
    if (!id.success) return "nudge_missing";
    const { data, error } = await supabase
      .from("nudges")
      .update({ state: "dismissed" })
      .eq("user_id", user.id)
      .eq("id", id.data)
      .eq("state", "open")
      .select("id");
    if (error) throw error;
    return data?.length === 1 ? "nudge_dismissed" : "nudge_missing";
  });
}