"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Subtle enter-only page transition. We intentionally do NOT use
 * AnimatePresence with an exit animation, because Next.js App Router
 * replaces the DOM synchronously on navigation — an exit animation
 * produces a blank gap while the old tree is still fading out and
 * the new tree hasn't mounted yet.
 *
 * Keying on pathname re-mounts the motion div when the route changes,
 * which gives us a clean fade-in-from-below for each page.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
