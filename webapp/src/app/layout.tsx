import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: BUSINESS.name,
  description: `${BUSINESS.tagline.th} · ${BUSINESS.location.th}`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fbf6ef",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
