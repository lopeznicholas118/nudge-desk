import {describe, expect, it} from "vitest";
import {FIXTURE_IDS as ID, fixtureStore} from "./testing";
import {TOOLS, ToolError, type ToolContext} from "./tools";

const NOW = new Date("2026-10-09T12:00:00Z");

function makeCtx(over: Partial<ToolContext> = {}): ToolContext {
  return { store: fixtureStore(NOW), now: NOW, runId: null, maxDrafts: 3, draftIds: [], ...over };
}

async function run(name: string, input: unknown, ctx: ToolContext = makeCtx()): Promise<any> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool.execute(input, ctx);
}

const draft = (over: Record<string, unknown> = {}) => ({
  contact_id: ID.ben,
  language: "en",
  body: "Hey Ben, how did the resume review go? Want to catch up this week?",
  rationale: "It has been 45 days and you have a resume review coming up.",
  ...over,
});

describe("tool specs", () => {
  it("expose clean JSON Schema objects", () => {
    for (const tool of TOOLS) {
      expect(tool.spec.inputSchema.type).toBe("object");
      expect(tool.spec.inputSchema).not.toHaveProperty("$schema");
    }
  });

  it("require the right fields", () => {
    const required = (name: string) =>
      ((TOOLS.find((t) => t.name === name)?.spec.inputSchema as { required?: string[] }).required ?? []);
    expect(required("save_draft")).toEqual(expect.arrayContaining(["contact_id", "language", "body", "rationale"]));
    expect(required("list_overdue_contacts")).not.toContain("limit");
  });
});

describe("list_overdue_contacts", () => {
  it("returns overdue contacts, most overdue first, with reasons", async () => {
    const out = await run("list_overdue_contacts", {});
    expect(out.contacts.map((c: { contact_id: string }) => c.contact_id)).toEqual([ID.alex, ID.ben, ID.maria]);
    expect(out.contacts[0].status).toBe("never_contacted");
    expect(out.contacts[1].why).toBe("Last contact 45 days ago (close contacts: about every 30 days).");
  });

  it("respects the limit and rejects out-of-range values", async () => {
    expect((await run("list_overdue_contacts", {limit: 1})).contacts).toHaveLength(1);
    await expect(run("list_overdue_contacts", {limit: 50})).rejects.toBeInstanceOf(ToolError);
  });

  it("leaves out contacts that already have a pending draft", async () => {
    const ctx = makeCtx();
    await run("save_draft", draft(), ctx);
    const out = await run("list_overdue_contacts", {}, ctx);
    expect(out.contacts.map((c: { contact_id: string }) => c.contact_id)).toEqual([ID.alex, ID.maria]);
  });
});

describe("get_contact_context", () => {
  it("splits past and upcoming interactions", async () => {
    const out = await run("get_contact_context", { contact_id: ID.ben });
    expect(out.recent_interactions).toEqual([
      { kind: "call", date: "2026-08-25", summary_untrusted: "Talked through his resume" },
    ]);
    expect(out.upcoming_meetings).toEqual([{ date: "2026-10-11", title_untrusted: "Resume review" }]);
  });

  it("keeps injected text confined to the _untrusted field", async () => {
    const out = await run("get_contact_context", { contact_id: ID.alex });
    const carriers = Object.entries(out)
      .filter(([, value]) => JSON.stringify(value).includes("Ignore all previous instructions"))
      .map(([key]) => key);
    expect(carriers).toEqual(["notes_untrusted"]);
  });

  it("fails cleanly for an unknown contact", async () => {
    await expect(
      run("get_contact_context", { contact_id: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toThrow(/No contact/);
  });
});

describe("get_upcoming_meetings", () => {
  it("lists meetings inside the window", async () => {
    const out = await run("get_upcoming_meetings", { days: 7 });
    expect(out.meetings).toEqual([
      { contact_id: ID.ben, name: "Ben Carter", date: "2026-10-11", title_untrusted: "Resume review" },
    ]);
  });
});

describe("save_draft", () => {
  it("saves a pending draft and records its id", async () => {
    const ctx = makeCtx();
    const out = await run("save_draft", draft(), ctx);
    expect(out).toMatchObject({ saved: true });
    expect(ctx.draftIds).toHaveLength(1);
  });

  it("rejects a language that doesn't match the contact", async () => {
    await expect(run("save_draft", draft({ contact_id: ID.maria, language: "en" }))).rejects.toThrow(/prefers 'es'/);
  });

  it("rejects a second pending draft for the same contact", async () => {
    const ctx = makeCtx();
    await run("save_draft", draft(), ctx);
    await expect(run("save_draft", draft(), ctx)).rejects.toThrow(/already has a pending draft/);
  });

  it("enforces the per-run draft limit", async () => {
    await expect(run("save_draft", draft(), makeCtx({ maxDrafts: 0 }))).rejects.toThrow(/Draft limit/);
  });

  it("rejects invalid arguments with a readable message", async () => {
    await expect(run("save_draft", draft({ body: "hi" }))).rejects.toThrow(/Invalid arguments/);
  });
});