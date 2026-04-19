"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  ACCENT_COLORS,
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "@/lib/preferences/types";

/**
 * React context for user preferences.
 *
 * We hydrate from the server via a `preferences` prop passed in by
 * `<PreferencesProvider>` at the top of `(main)/layout.tsx`. The provider
 * then:
 *   - Applies density + accent as global CSS custom properties on <html>
 *     so any component can read them (including non-React parts like
 *     inline styles on email preview iframes etc.).
 *   - Exposes the latest `preferences` snapshot via `usePreferences()`.
 *   - Offers an optimistic `setPreferences(patch)` helper that server
 *     actions reconcile with the authoritative copy.
 */

interface PreferencesCtx {
  preferences: UserPreferences;
  /** Optimistically merge a partial update into the local snapshot. Server
   *  action caller is responsible for persisting + refreshing. */
  setLocal: (patch: Partial<UserPreferences>) => void;
}

const Context = createContext<PreferencesCtx | null>(null);

export function PreferencesProvider({
  initial,
  children,
}: {
  initial: UserPreferences;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<UserPreferences>(initial);

  // Apply CSS tokens whenever prefs change. Kept idempotent — safe if the
  // server and client initial values match (they should, since both read
  // from the DB).
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.density = prefs.listDensity;
    html.style.setProperty(
      "--accent",
      ACCENT_COLORS[prefs.accentColor]?.hex ?? ACCENT_COLORS.indigo.hex,
    );
  }, [prefs]);

  const value: PreferencesCtx = {
    preferences: prefs,
    setLocal: (patch) => setPrefs((prev) => ({ ...prev, ...patch })),
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Consume preferences from anywhere inside `(main)/layout.tsx`. */
export function usePreferences(): UserPreferences {
  const ctx = useContext(Context);
  if (!ctx) return DEFAULT_PREFERENCES; // sane fallback if provider is absent
  return ctx.preferences;
}

/** Local-only update (optimistic). Actual persistence is via the server action. */
export function usePreferencesSetter(): (patch: Partial<UserPreferences>) => void {
  const ctx = useContext(Context);
  if (!ctx) return () => { /* no-op outside provider */ };
  return ctx.setLocal;
}
