import {fileURLToPath} from "node:url";
import {config} from "dotenv";

/** Loads the web app's env file if it exists. Existing environment variables win (CI sets them directly). */
export function loadEnv() {
  config({path: fileURLToPath(new URL("../../../apps/web/.env.local", import.meta.url)), quiet: true});
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Set it in apps/web/.env.local or your shell.`);
  return value;
}

/** Absolute path of a file or folder inside packages/evals, independent of the working directory. */
export const packagePath = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));