"use client";

import { useEffect } from "react";
import { ACCENT_COLORS, type UserPreferences } from "@/lib/preferences/types";

/**
 * Applies density + accent tokens to <html> as early as possible so the
 * first paint already honours the user's preference. The PreferencesProvider
 * reapplies them on changes; this ensures SSR'd pages don't flash the
 * default indigo before the provider's effect runs.
 */
export function PreferencesBootstrap({ prefs }: { prefs: UserPreferences }) {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.density = prefs.listDensity;
    html.style.setProperty(
      "--accent",
      ACCENT_COLORS[prefs.accentColor]?.hex ?? ACCENT_COLORS.indigo.hex,
    );
  }, [prefs.listDensity, prefs.accentColor]);
  return null;
}
