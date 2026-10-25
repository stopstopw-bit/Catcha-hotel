import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerLineId, noCustomerSessionResponse } from "@/lib/customer-session";
import {
  findCustomerByLine,
  updateCustomer,
  updateCat,
  addCat,
  normalizeWeightKg,
} from "@/lib/customers-store";
import { sendTelegramLater, formatBookingTelegram } from "@/lib/telegram";

/** ลูกค้าดึงข้อมูลตัวเอง (สำหรับหน้าแก้ไขโปรไฟล์ใน LINE) — ครบทุกฟิลด์ที่กรอกตอนสมัคร */
export async function GET(req: NextRequest) {
  const lineUserId = await resolveCustomerLineId(
    req,
    req.nextUrl.searchParams.get("lineUserId")
  );
  if (!lineUserId) {
    return noCustomerSessionResponse();
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
      consentAcceptedAt: c.consentAcceptedAt || "",
      marketingConsent: c.marketingConsent !== false,
      cats: c.cats.map((x) => ({
        id: x.id,
        name: x.name,
        gender: x.gender || "",
        breed: x.breed || "",
        ageValue: x.ageValue ?? "",
        ageUnit: x.ageUnit || "year",
        weightKg: x.weightKg ?? "",
        neutered: x.neutered ?? null,
        seizureHistory: x.seizureHistory ?? "",
        allergy: x.allergy ?? "",
        birthday: x.birthday || "",
        medical: x.medical || "",
        note: x.staffNote || "",
        needsConfirm: Boolean(x.needsOwnerConfirm),
        // หน้าแนบสมุดวัคซีน/ฟอร์มประวัติใช้บอกลูกค้าว่าส่งอะไรไปแล้วบ้าง (ไม่ส่งตัวรูปออกไป)
        vaccineCount: x.vaccinePhotos ? x.vaccinePhotos.split("\n").filter(Boolean).length : 0,
        hasPetInfo: Boolean(x.groomHealthInfo),
        hasStayInfo: Boolean(x.stayInfo),
      })),
    },
  });
}

/** ลูกค้าแก้ไขข้อมูลตัวเอง — ผู้ปกครอง + น้องแมว (ยืนยันตัวจาก lineUserId ของ LIFF) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lineUserId = await resolveCustomerLineId(req, body.lineUserId);
  if (!lineUserId) {
    return noCustomerSessionResponse();
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
      const neutered = typeof cat.neutered === "boolean" ? cat.neutered : undefined;
      // หน้าเก่าที่ยังไม่มีช่องประวัติชัก/แพ้ จะไม่ส่งมา — คงค่าเดิมไว้
      const history = {
        ...("seizureHistory" in cat ? { seizureHistory: String(cat.seizureHistory || "") } : {}),
        ...("allergy" in cat ? { allergy: String(cat.allergy || "") } : {}),
      };
      if (!cat.id) {
        const after = await addCat(c.id, { ...fields, ...history, weightKg, neutered }, { source: "customer" });
        const id = after?.cats[after.cats.length - 1]?.id;
        if (id) created.push({ index, id });
      } else {
        // หน้าเก่าที่ยังไม่มีช่องน้ำหนักจะไม่ส่ง weightKg มา — อย่าไปลบค่าที่ร้านกรอกไว้
        await updateCat(
          c.id,
          String(cat.id),
          {
            ...fields,
            ...("weightKg" in cat ? { weightKg: weightKg ?? null } : {}),
            ...("neutered" in cat ? { neutered: neutered ?? null } : {}),
            ...history,
          },
          { source: "customer" }
        );
      }
    }
  }

  sendTelegramLater(
    formatBookingTelegram("✏️ ลูกค้าแก้ไขข้อมูลตัวเอง", {
      ลูกค้า: patch.name || c.name,
      เบอร์: patch.phone ?? c.phone ?? "-",
    })
  );

  return NextResponse.json({ ok: true, created });
}
