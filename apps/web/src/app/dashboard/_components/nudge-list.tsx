import {dismissNudge} from "../review-actions";
import {ui} from "./ui";

export type NudgeView = {
  id: string;
  name: string;
  tier: string;
  reason: string;
  hasDraft: boolean;
};

export function NudgeList({ nudges }: { nudges: NudgeView[] }) {
  if (nudges.length === 0) return <p className="text-gray-500">No open nudges this week.</p>;

  return (
    <ul className="divide-y">
      {nudges.map((n) => (
        <li key={n.id} className="flex items-start justify-between gap-4 py-3">
          <div>
            <p>
              <strong>{n.name}</strong> <span className="text-gray-500">({n.tier})</span>
              {n.hasDraft && (
                <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">draft ready</span>
              )}
            </p>
            <p className="text-sm text-gray-500">{n.reason}</p>
          </div>
          <form action={dismissNudge}>
            <input type="hidden" name="nudge_id" value={n.id} />
            <button className={ui.button}>Dismiss</button>
          </form>
        </li>
      ))}
    </ul>
  );
}