import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import { MOVE_TABLES, copyFiles, copyTable, moveStatus, prepareTarget } from "@/lib/move-db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ย้ายฐานข้อมูลกระทบทั้งร้าน — เจ้าของร้านเท่านั้น */
async function ownerOnly(req: NextRequest) {
  return (await getSessionFrom(req))?.role === "owner";
}

export async function GET(req: NextRequest) {
  if (!(await ownerOnly(req))) return NextResponse.json({ error: "เฉพาะเจ้าของร้าน" }, { status: 403 });
  return NextResponse.json({ status: moveStatus(), tables: MOVE_TABLES });
}

/** body: { step: "prepare" } | { step: "table", table } | { step: "files", offset } */
export async function POST(req: NextRequest) {
  if (!(await ownerOnly(req))) return NextResponse.json({ error: "เฉพาะเจ้าของร้าน" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { step?: string; table?: string; offset?: number };
  try {
    if (body.step === "prepare") return NextResponse.json(await prepareTarget());
    if (body.step === "table" && body.table) return NextResponse.json(await copyTable(body.table));
    if (body.step === "files") return NextResponse.json(await copyFiles(Math.max(0, Number(body.offset) || 0)));
    return NextResponse.json({ error: "ไม่รู้จักขั้นตอนนี้" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
