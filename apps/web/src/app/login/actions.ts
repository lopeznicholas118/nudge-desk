"use server";

import {redirect} from "next/navigation";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";

const Credentials = z.object({
  email: z.email(),
  password: z.string().min(8),
});

function fail(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

function parseCredentials(formData: FormData) {
  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) fail("Enter a valid email and a password of at least 8 characters.");
  return parsed.data;
}

export async function signIn(formData: FormData) {
  const credentials = parseCredentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) fail(error.message);
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const credentials = parseCredentials(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) fail(error.message);
  if (!data.session) {
    redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account."));
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}