import { NextRequest, NextResponse } from "next/server";
import {
  listFinance,
  listFinanceEnriched,
  addFinanceEntry,
  updateFinanceEntry,
  deleteFinanceEntry,
  financeSummary,
  setFinanceExcluded,
} from "@/lib/finance-store";
import { uploadDataUrlToStorage } from "@/lib/supabase/storage";
import { logAudit } from "@/lib/audit-log";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/** ใครกดปุ่มนี้ — ไว้ลงบันทึกว่าใครแตะบัญชี */
async function actorName(req: NextRequest): Promise<string> {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return s?.name || s?.role || "ไม่ทราบ";
}

/** เก็บรูปบิลขึ้น storage — ถ้าเป็น data URL อัปแล้วคืน URL สั้น, ถ้าเป็น URL อยู่แล้วคืนเดิม */
async function storeReceipt(id: string, receipt?: string): Promise<string | undefined> {
  if (!receipt) return undefined;
  try {
    return await uploadDataUrlToStorage(`finance-receipts/${id}.jpg`, receipt);
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") || undefined;
  const to = req.nextUrl.searchParams.get("to") || undefined;
  const summary = req.nextUrl.searchParams.get("summary") === "1";

  if (summary) {
    return NextResponse.json({ summary: await financeSummary(from, to) });
  }

  return NextResponse.json({ records: await listFinanceEnriched(from, to) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = `F${Date.now()}`;
  const receiptUrl = await storeReceipt(id, body.receipt ? String(body.receipt) : undefined);
  const rec = await addFinanceEntry({
    type: body.type,
    amount: Number(body.amount),
    category: body.category || "ทั่วไป",
    description: body.description || "",
    date: body.date || new Date().toISOString().slice(0, 10),
    customerId: body.customerId,
    invoiceId: body.invoiceId,
    receiptUrl,
  });
  return NextResponse.json({ ok: true, record: rec });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // ติ๊ก "ไม่นับเป็นรายได้" — ยอดยกมาจากระบบเก่า เก็บแถวไว้แต่ไม่เข้ายอดสรุป/เอกสารภาษี
  if (body.action === "set_excluded") {
    const res = await setFinanceExcluded(String(body.id), body.excluded === true);
    if (res.ok) {
      await logAudit({
        actor: await actorName(req),
        action: body.excluded === true ? "exclude_finance" : "include_finance",
        resourceType: "finance",
        resourceId: String(body.id),
      });
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error, needSql: res.error === "need_sql" },
        { status: res.error === "need_sql" ? 200 : 404 }
      );
    }
    return NextResponse.json({ ok: true });
  }
  // receipt: data URL = แนบใหม่, "" = เอารูปออก, undefined = ไม่แตะ
  let receiptUrl: string | undefined;
  if (body.receipt !== undefined) {
    receiptUrl = body.receipt ? await storeReceipt(String(body.id), String(body.receipt)) || "" : "";
  }
  await updateFinanceEntry(body.id, {
    type: body.type,
    amount: body.amount != null ? Number(body.amount) : undefined,
    category: body.category,
    description: body.description,
    date: body.date,
    receiptUrl,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteFinanceEntry(id);
  return NextResponse.json({ ok: true });
}
