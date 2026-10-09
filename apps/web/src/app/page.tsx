import {APP_NAME} from "@nudge/core";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
      <h2 className="text-xl font-semibold">Your personal network assistant</h2>
    </main>
  );
}