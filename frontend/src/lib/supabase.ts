/**
 * Supabase browser client.
 *
 * Reads Vite-inlined env (must be present at BUILD time, set per Vercel
 * environment). If the URL or key is missing we log a loud, specific error and
 * export `null` so the app boots logged-out instead of firing keyless requests
 * that Supabase rejects with "No API key found in request".
 */
import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
// Publishable key is preferred; anon key kept as a backward-compatible fallback.
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

if (!url || !key) {
  const missing = [
    !url && "VITE_SUPABASE_URL",
    !key && "VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)",
  ]
    .filter(Boolean)
    .join(", ");
  console.error(
    `[supabase] Missing config: ${missing}. Auth is disabled until these are ` +
      `set for this Vercel environment (Production vs Preview) and the app is rebuilt.`,
  );
}

export const supabase = url && key ? createClient(url, key) : null;
