"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Google Analytics 4 for the public marketing pages only (home, blog, service pages).
 * Same GA property as guide.catchahotel.com, so one report shows guide → main site → LINE.
 * Back office (/admin), customer LIFF app (/app), docs and API are never tracked.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-LM8YRTCNFT";
const PRIVATE_PREFIXES = ["/admin", "/app", "/doc", "/api", "/liff"];

type Gtag = (...args: unknown[]) => void;

export function isPublicPath(path: string): boolean {
  return !PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export default function PublicAnalytics() {
  const pathname = usePathname() || "/";
  const enabled = Boolean(GA_ID) && isPublicPath(pathname);

  // Count taps on any LINE link (line.me / lin.ee) as a `line_click` event.
  useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (!/\/\/([a-z0-9-]+\.)?line\.me\/|\/\/lin\.ee\//i.test(a.href)) return;
      const gtag = (window as typeof window & { gtag?: Gtag }).gtag;
      gtag?.("event", "line_click", { placement: `${pathname}` });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
