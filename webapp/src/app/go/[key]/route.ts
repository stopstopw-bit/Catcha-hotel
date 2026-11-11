import { NextResponse, type NextRequest } from "next/server";
import { LINK_BUTTONS, cleanSrc, isBotUserAgent } from "@/lib/link-hub";
import { recordLinkEvent } from "@/lib/link-clicks-store";

export const dynamic = "force-dynamic";

/** ปุ่มบนหน้า /links: นับคลิก (ปุ่ม + แพลตฟอร์ม) แล้วพาไปปลายทาง */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const src = cleanSrc(req.nextUrl.searchParams.get("src"));
  const button = LINK_BUTTONS.find((b) => b.key === key);
  if (!button) return NextResponse.redirect(new URL(`/links${src === "direct" ? "" : `/${src}`}`, req.url), 302);

  if (!isBotUserAgent(req.headers.get("user-agent"))) {
    await recordLinkEvent("click", src, button.key);
  }
  const href = button.href(src);
  const dest = /^[a-z]+:/i.test(href) ? href : new URL(href, req.url).toString();
  return new NextResponse(null, { status: 302, headers: { Location: dest, "Cache-Control": "no-store" } });
}
