"use client";

import { useSyncExternalStore } from "react";

/** SSR-safe media query hook (false on the server and first paint). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind `lg` breakpoint (1024px): master/detail layouts switch on here. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
