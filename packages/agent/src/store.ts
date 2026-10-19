import type {Language, Tier} from "@nudge/core";

export type ContactSummary = {
  id: string;
  fullName: string;
  tier: Tier;
  preferredLanguage: Language;
  lastInteractionAt: Date | null;
};

export type ContactDetail = ContactSummary & {
  company: string | null;
  notes: string | null;
};

export type InteractionRecord = {
  kind: string;
  occurredAt: Date;
  summary: string | null;
};

export type UpcomingMeeting = {
  contactId: string;
  contactName: string;
  occurredAt: Date;
  summary: string | null;
};

export type NewDraft = {
  contactId: string;
  language: Language;
  body: string;
  rationale: string | null;
  runId: string | null;
};

export type InsertDraftResult =
  | { ok: true; id: string }
  | { ok: false; reason: "duplicate_pending" | "unknown_contact" };

/** Everything the agent may read or write. Implemented over Supabase in the web app. */
export interface AgentStore {
  listContacts(): Promise<ContactSummary[]>;
  getContact(id: string): Promise<ContactDetail | null>;
  /** Most recent first. Includes future-dated interactions (upcoming meetings). */
  listInteractions(contactId: string, limit: number): Promise<InteractionRecord[]>;
  listUpcomingMeetings(from: Date, to: Date): Promise<UpcomingMeeting[]>;
  listPendingDraftContactIds(): Promise<string[]>;
  insertDraft(draft: NewDraft): Promise<InsertDraftResult>;
}