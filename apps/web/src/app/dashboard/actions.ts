"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {NewContactSchema} from "@nudge/core";
import {disconnectConnection} from "@/lib/google/connection";
import {runCalendarSync} from "@/lib/google/sync";
import {createClient} from "@/lib/supabase/server";
import {runAgentForUser} from "@/lib/agent/run";
import {describeError} from "@/lib/errors";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return {supabase, user};
}

const back = (key: string, value: string) => `/dashboard?${key}=${encodeURIComponent(value)}`;

export async function addContact(formData: FormData) {
  const {supabase} = await requireUser();

  const parsed = NewContactSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email") || undefined,
    tier: formData.get("tier") || undefined,
  });
  if (!parsed.success) redirect(back("error", parsed.error.issues[0]?.message ?? "Invalid contact"));

  const {error} = await supabase.from("contacts").insert(parsed.data);
  if (error) {
    redirect(back("error", error.code === "23505" ? "You already have a contact with that email." : "Could not save contact."));
  }
  revalidatePath("/dashboard");
}

export async function syncCalendar() {
  const {supabase, user} = await requireUser();

  const outcome = await runCalendarSync(supabase, user.id, new Date()).catch((err: unknown) => {
    console.error("calendar sync failed:", err instanceof Error ? err.message : "unknown error");
    return null;
  });
  if (!outcome) redirect(back("sync", "failed"));
  if (!outcome.ok) redirect(back("sync", outcome.reason));
  revalidatePath("/dashboard");
}

export async function disconnectGoogle() {
  const {user} = await requireUser();
  await disconnectConnection(user.id);
  revalidatePath("/dashboard");
}

export async function runAgentNow() {
  const {supabase, user} = await requireUser();

  const outcome = await runAgentForUser(supabase, user.id, "manual").catch((err: unknown) => {
    console.error("agent run failed:", describeError(err));
    return null;
  });
  if (!outcome) redirect("/dashboard?agent=failed");

  revalidatePath("/dashboard");
  redirect(`/dashboard?agent=${outcome.result.status}&drafts=${outcome.result.draftIds.length}`);
}