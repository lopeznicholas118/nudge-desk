import {signIn, signUp} from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const input = "w-full rounded border border-gray-300 px-3 py-2 text-white";
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Nudge Desk</h1>
      {error && <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-800">{error}</p>}
      {message && <p className="mt-4 rounded bg-green-100 p-3 text-green-800">{message}</p>}
      <form className="mt-6 flex flex-col gap-3">
        <input className={input} name="email" type="email" placeholder="Email" required autoComplete="email" />
        <input className={input} name="password" type="password" placeholder="Password (8+ characters)" required minLength={8} autoComplete="current-password" />
        <button formAction={signIn} className="rounded border border-gray-400 px-3 py-2">Sign in</button>
        <button formAction={signUp} className="rounded border border-gray-400 px-3 py-2">Create account</button>
      </form>
    </main>
  );
}