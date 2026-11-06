import type {Row} from "@nudge/db";
import {approveDraft, discardDraft, saveDraft, translateDraft} from "../review-actions";
import {ui} from "./ui";

export type DraftView = Pick<Row<"drafts">, "id" | "language" | "alt_language" | "body" | "rationale">;

export function DraftCard({ draft, contactName }: { draft: DraftView; contactName: string }) {
  const other = draft.language === "es" ? "en" : "es";
  const otherName = other === "es" ? "Spanish" : "English";
  // With a stored translation the toggle is a free swap, not another model call.
  const toggleLabel = draft.alt_language === other ? `Switch to ${otherName}` : `Translate to ${otherName}`;

  return (
    <li className="rounded border border-gray-300 p-3">
      <p className="text-sm font-semibold">
        {contactName} <span className="font-normal text-gray-500">({draft.language.toUpperCase()})</span>
      </p>
      <form className="mt-2 space-y-2">
        <input type="hidden" name="draft_id" value={draft.id} />
        <textarea
          name="body"
          defaultValue={draft.body}
          rows={5}
          maxLength={2000}
          aria-label={`Draft message to ${contactName}`}
          className={`${ui.input} w-full`}
        />
        {draft.rationale && <p className="text-sm text-gray-500">Why: {draft.rationale}</p>}
        <div className="flex flex-wrap gap-2">
          <button formAction={approveDraft} className={ui.primary}>Approve</button>
          <button formAction={saveDraft} className={ui.button}>Save edits</button>
          <button formAction={translateDraft} name="target" value={other} className={ui.button}>
            {toggleLabel}
          </button>
          <button formAction={discardDraft} className={ui.button}>Discard</button>
        </div>
      </form>
    </li>
  );
}