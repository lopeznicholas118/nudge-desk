import {APP_NAME} from "@nudge/core";
import Link from "next/link";

const STEPS = [
  {
    title: "Log In",
    body: "Log in to your dashboard and sync your Google Calendar.",
  },
  {
    title: "Add your Contacts",
    body: "Input the name, e-mail, and relationship proximity (close, warm, weak).",
  },
  {
    title: "Run the Agent",
    body: "Claude detects the language and, depending on when it was the last time you contacted that person, drafts a reply in the your contact's own language (English or Spanish).",
  },
  {
    title: "Edit the Draft",
    body: "You review and edit every draft. Nothing is marked sent without a named reviewer signing off.",
  },
];

const REL_PROX = [
  {
    title: "close",
    body: "30 days"
  },
  {
    title: "warm",
    body: "90 days"
  },
  {
    title: "weak",
    body: "180 days"
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
      <h2 className="mt-0.5 text-2xl font-semibold text-gray-400">Your personal network assistant</h2>
      <p className="mt-2 text-gray-600">An AI assistant tells you who you&apos;re overdue to contact and drafts the response in your voice (English or Spanish). 
        <br />The agent never sends anything without <strong>you</strong>.</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="rounded border px-5 py-2.5 text-sm">
          Sign In or Sign Up
        </Link>
      </div>

      <ol className="mt-10 space-y-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm">
              {i + 1}
            </span>
            <div>
              <h2 className="font-medium font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-xl font-semibold text-gray-400">Relationship Proximity</h2>
      <p className="text-gray-600"> The agent creates a draft, on your request, for overdue contacts after these amount of days pass:</p>
      <ol className="mt-3 space-y-6">
        {REL_PROX.map((step) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-15 w-15 items-center justify-center border font-semibold text-xl text-gray-400">
              {step.title}
            </span>
            <div>
              <p className="mt-4.5 text-gray-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm text-gray-600">
        Try it for yourself. Create an account, add your contacts, and run the agent. <br/><br/>
        <a href="https://github.com/lopeznicholas118/nudge-desk"
           className="underline">
          Source on GitHub.
        </a>
      </p>
    </main>
  );
}