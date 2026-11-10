import {markDraftSent} from "../review-actions";
import {CopyButton} from "./copy-button";
import type {DraftView} from "./draft-card";
import {ui} from "./ui";

export function ApprovedCard({
  draft,
  contactName,
  contactEmail,
}: {
  draft: Pick<DraftView, "id" | "language" | "body">;
  contactName: string;
  contactEmail: string | null;
}) {
  // encodeURIComponent escapes ? and & in the address, so it can't smuggle in extra mailto fields.
  const mailto = contactEmail
    ? `mailto:${encodeURIComponent(contactEmail).replace(/%40/g, "@")}?body=${encodeURIComponent(draft.body)}`
    : null;

  return (
    <li className="rounded border border-gray-300 p-3">
      <p className="text-sm font-semibold">
        {contactName} <span className="font-normal text-gray-500">({draft.language.toUpperCase()})</span>
      </p>
      <p className="mt-1 whitespace-pre-wrap">{draft.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={draft.body} />
        {mailto && (
          <a href={mailto} className={ui.button}>Open in email app</a>
        )}
        <form action={markDraftSent}>
          <input type="hidden" name="draft_id" value={draft.id} />
          <button className={ui.primary}>I sent it</button>
        </form>
      </div>
    </li>
  );
}