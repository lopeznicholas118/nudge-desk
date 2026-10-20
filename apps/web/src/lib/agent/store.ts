import "server-only";
import {z} from "zod";
import {LanguageSchema, TierSchema} from "@nudge/core";
import type {AgentStore} from "@nudge/agent";
import type {createClient} from "@/lib/supabase/server";

// Same pattern as sync.ts. Step 6 widens this so the cron job can pass its own client.
type UserClient = Awaited<ReturnType<typeof createClient>>;

const SummaryRow = z.object({
  id: z.uuid(),
  full_name: z.string(),
  tier: TierSchema,
  preferred_language: LanguageSchema,
  last_interaction_at: z.string().nullable(),
});
const DetailRow = SummaryRow.extend({
  company: z.string().nullable(),
  notes: z.string().nullable(),
});

const toDate = (value: string | null) => (value === null ? null : new Date(value));

export function createSupabaseStore(supabase: UserClient, userId: string): AgentStore {
  // Every query filters by user_id explicitly, on top of RLS (defense in depth).
  return {
    async listContacts() {
      const { data, error } = await supabase
        .from("contacts_with_last_interaction")
        .select("id, full_name, tier, preferred_language, last_interaction_at")
        .eq("user_id", userId);
      if (error) throw error;
      return z.array(SummaryRow).parse(data).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        tier: r.tier,
        preferredLanguage: r.preferred_language,
        lastInteractionAt: toDate(r.last_interaction_at),
      }));
    },

    async getContact(id) {
      const { data, error } = await supabase
        .from("contacts_with_last_interaction")
        .select("id, full_name, tier, preferred_language, company, notes, last_interaction_at")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const r = DetailRow.parse(data);
      return {
        id: r.id,
        fullName: r.full_name,
        tier: r.tier,
        preferredLanguage: r.preferred_language,
        company: r.company,
        notes: r.notes,
        lastInteractionAt: toDate(r.last_interaction_at),
      };
    },

    async listInteractions(contactId, limit) {
      const { data, error } = await supabase
        .from("interactions")
        .select("kind, occurred_at, summary")
        .eq("user_id", userId)
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => ({ kind: r.kind, occurredAt: new Date(r.occurred_at), summary: r.summary }));
    },

    async listUpcomingMeetings(from, to) {
      const { data, error } = await supabase
        .from("interactions")
        .select("contact_id, occurred_at, summary")
        .eq("user_id", userId)
        .eq("kind", "meeting")
        .gt("occurred_at", from.toISOString())
        .lte("occurred_at", to.toISOString())
        .order("occurred_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const ids = [...new Set(rows.map((r) => r.contact_id))];
      const { data: people, error: peopleError } = await supabase
        .from("contacts")
        .select("id, full_name")
        .eq("user_id", userId)
        .in("id", ids);
      if (peopleError) throw peopleError;
      const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

      return rows.flatMap((r) => {
        const name = names.get(r.contact_id);
        return name === undefined
          ? []
          : [{ contactId: r.contact_id, contactName: name, occurredAt: new Date(r.occurred_at), summary: r.summary }];
      });
    },

    async listPendingDraftContactIds() {
      const { data, error } = await supabase
        .from("drafts")
        .select("contact_id")
        .eq("user_id", userId)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).map((r) => r.contact_id);
    },

    async insertDraft(draft) {
      const { data, error } = await supabase
        .from("drafts")
        .insert({
          user_id: userId,
          contact_id: draft.contactId,
          run_id: draft.runId,
          language: draft.language,
          body: draft.body,
          rationale: draft.rationale,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") return {ok: false, reason: "duplicate_pending"};
        if (error.code === "23503") return {ok: false, reason: "unknown_contact"};
        throw error;
      }
      return {ok: true, id: data.id};
    },
  };
}