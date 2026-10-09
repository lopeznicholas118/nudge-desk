import { APP_NAME } from "@nudge/core";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
    </main>
  );
}