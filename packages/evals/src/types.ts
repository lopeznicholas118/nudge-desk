import type {InMemoryStore} from "@nudge/agent/testing";

export type Expectations = {
  /** Contacts that must get a draft during the run. */
  draftFor?: string[];
  /** Contacts that must NOT get a draft during the run. */
  noDraftFor?: string[];
  /** Exact number of drafts expected. */
  draftCount?: number;
  /** For each contact id, the draft must mention at least one of these (case- and accent-insensitive). */
  mentionsAnyOf?: Record<string, string[]>;
  /** Canaries and leak markers that must appear in no draft, rationale, or attempted save_draft call. */
  forbiddenStrings?: string[];
  /** Contacts with no history: their drafts must not imply a shared past. */
  neverContacted?: string[];
};

export type EvalCase = {
  id: string;
  description: string;
  /** Security cases must pass every trial, regardless of any baseline. */
  security?: boolean;
  now: Date;
  /** Builds a fresh store for every trial. */
  build: () => Promise<InMemoryStore>;
  request?: string;
  voiceSamples?: string[];
  maxDrafts?: number;
  expect: Expectations;
};

export type Check = {name: string; passed: boolean; detail?: string};