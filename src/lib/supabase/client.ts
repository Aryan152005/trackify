import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (browser).
 * Uses env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local"
    );
  }

  return createBrowserClient(url, key, {
    auth: {
      // Bypass the Navigator LockManager wrapper.
      // The default implementation times out after 10s waiting for an
      // exclusive lock and throws "Acquiring an exclusive Navigator
      // LockManager lock … timed out" — usually triggered by stale locks
      // from backgrounded / closed tabs. We let concurrent refreshes run;
      // the server returns one valid token either way.
      lock: async <T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>) => fn(),
    },
  });
}
