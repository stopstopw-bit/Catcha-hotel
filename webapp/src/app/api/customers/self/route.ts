import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerLineId } from "@/lib/customer-session";
import {
  findCustomerByLine,
  updateCustomer,
  updateCat,
  addCat,
  normalizeWeightKg,
} from "@/lib/customers-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** ลูกค้าดึงข้อมูลตัวเอง (สำหรับหน้าแก้ไขโปรไฟล์ใน LINE) — ครบทุกฟิลด์ที่กรอกตอนสมัคร */
export async function GET(req: NextRequest) {
  const lineUserId = await resolveCustomerLineId(
    req,
    req.nextUrl.searchParams.get("lineUserId")
  );
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  const c = await findCustomerByLine(lineUserId);
  if (!c) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      birthday: c.birthday || "",
      referralSource: c.referralSource || "",
      address: c.address || "",
      addressMapUrl: c.addressMapUrl || "",
      postalCode: c.postalCode || "",
      idCardUrl: c.idCardUrl || "",
      marketingConsent: c.marketingConsent !== false,
      cats: c.cats.map((x) => ({
        id: x.id,
        name: x.name,
        gender: x.gender || "",
        breed: x.breed || "",
        ageValue: x.ageValue ?? "",
        ageUnit: x.ageUnit || "year",
        weightKg: x.weightKg ?? "",
        birthday: x.birthday || "",
        medical: x.medical || "",
        note: x.staffNote || "",
        needsConfirm: Boolean(x.needsOwnerConfirm),
      })),
    },
  });
}

/** ลูกค้าแก้ไขข้อมูลตัวเอง — ผู้ปกครอง + น้องแมว (ยืนยันตัวจาก lineUserId ของ LIFF) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lineUserId = await resolveCustomerLineId(req, body.lineUserId);
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  const c = await findCustomerByLine(lineUserId);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: {
    name?: string;
    phone?: string;
    email?: string;
    birthday?: string;
    referralSource?: string;
    address?: string;
    addressMapUrl?: string;
    postalCode?: string;
    marketingConsent?: boolean;
  } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.phone === "string") patch.phone = body.phone.trim() || undefined;
  if (typeof body.email === "string") patch.email = body.email.trim() || undefined;
  if (typeof body.birthday === "string") patch.birthday = body.birthday.trim() || undefined;
  if (typeof body.referralSource === "string")
    patch.referralSource = body.referralSource.trim() || undefined;
  if (typeof body.address === "string") patch.address = body.address.trim() || undefined;
  if (typeof body.addressMapUrl === "string")
    patch.addressMapUrl = body.addressMapUrl.trim() || undefined;
  if (typeof body.postalCode === "string")
    patch.postalCode = body.postalCode.trim() || undefined;
  if (typeof body.marketingConsent === "boolean")
    patch.marketingConsent = body.marketingConsent;
  await updateCustomer(c.id, patch);

  // id ของน้องที่เพิ่งสร้าง เรียงตามลำดับใน body.cats — หน้าโปรไฟล์ใช้อัปรูปที่เลือกไว้ก่อนบันทึก
  const created: { index: number; id: string }[] = [];
  if (Array.isArray(body.cats)) {
    for (const [index, cat] of body.cats.entries()) {
      if (typeof cat?.name !== "string" || !cat.name.trim()) continue;
      const fields = {
        name: cat.name.trim(),
        gender:
          cat.gender === "male" || cat.gender === "female" ? cat.gender : undefined,
        breed: cat.breed ? String(cat.breed).trim() : undefined,
        ageValue:
          cat.ageValue !== "" && cat.ageValue != null && !isNaN(Number(cat.ageValue))
            ? Number(cat.ageValue)
            : undefined,
        ageUnit: cat.ageUnit === "month" ? ("month" as const) : ("year" as const),
        birthday: cat.birthday ? String(cat.birthday) : undefined,
        medical: cat.medical ? String(cat.medical).trim() : undefined,
        staffNote: cat.note ? String(cat.note).trim() : undefined,
      };
      // ไม่มี id = น้องที่ลูกค้าเพิ่มเองในหน้านี้ → สร้างใหม่ (ไม่ต้องทักแชทให้ร้านเพิ่มให้)
      const weightKg = normalizeWeightKg(cat.weightKg);
      if (!cat.id) {
        const after = await addCat(c.id, { ...fields, weightKg }, { source: "customer" });
        const id = after?.cats[after.cats.length - 1]?.id;
        if (id) created.push({ index, id });
      } else {
        // หน้าเก่าที่ยังไม่มีช่องน้ำหนักจะไม่ส่ง weightKg มา — อย่าไปลบค่าที่ร้านกรอกไว้
        await updateCat(
          c.id,
          String(cat.id),
          { ...fields, ...("weightKg" in cat ? { weightKg: weightKg ?? null } : {}) },
          { source: "customer" }
        );
      }
    }
  }

  await sendTelegram(
    formatBookingTelegram("✏️ ลูกค้าแก้ไขข้อมูลตัวเอง", {
      ลูกค้า: patch.name || c.name,
      เบอร์: patch.phone ?? c.phone ?? "-",
    })
  );

  return NextResponse.json({ ok: true, created });
}
