import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerLineId, noCustomerSessionResponse } from "@/lib/customer-session";
import {
  registerCustomerFromLine,
  findCustomerByReferralCode,
  setReferredBy,
  recalculateCustomerTier,
} from "@/lib/customers-store";
import { parseCatInput } from "@/lib/cat-input";
import { formatBookingTelegram } from "@/lib/telegram";
import { getSiteConfig } from "@/lib/config-store";
import { isFeatureOn } from "@/lib/features";
import { referralReward } from "@/lib/referral";
import { issueCoupon, listCustomerCoupons } from "@/lib/coupons-store";
import { pushLineMessage } from "@/lib/line";
import { runAfterResponse, sendTelegramLater } from "@/lib/after-response";

/** คูปองชวนเพื่อน — ออกให้ทั้งคู่ทันทีที่สมัครด้วยโค้ด (เจ้าของร้านเลือกแบบนี้ 2026-10-23)
 * มูลค่า/อายุคูปองตั้งได้ในตั้งค่า › เปิด/ปิดฟีเจอร์ (ดู referralReward) */
const REFERRAL_TAG = "เพื่อนแนะนำ";

/** ลูกค้ากรอกฟอร์มลงทะเบียน (ผู้ปกครอง + น้องแมว + ยินยอมรับข่าวสาร) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lineUserId = (await resolveCustomerLineId(req, body.lineUserId)) || "";
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const birthday = String(body.birthday || "").trim();
  const referralSource = String(body.referralSource || "").trim();
  const address = String(body.address || "").trim();
  const addressMapUrl = String(body.addressMapUrl || "").trim();
  const postalCode = String(body.postalCode || "").trim();
  const marketingConsent = body.marketingConsent !== false;
  const cats = Array.isArray(body.cats)
    ? body.cats.map(parseCatInput)
    : [];

  if (!lineUserId) {
    return noCustomerSessionResponse();
  }
  // โค้ดเพื่อนแนะนำ (มาจากลิงก์ หรือลูกค้าพิมพ์เอง) — กรอกผิดบอกก่อนบันทึก จะได้แก้ได้
  // ร้านปิด "ชวนเพื่อนรับคูปอง" ในตั้งค่า — ไม่สนโค้ด (ไม่ผูกคนชวน ไม่แจกคูปอง)
  const siteCfg = await getSiteConfig();
  const reward = referralReward(siteCfg);
  const refCode = isFeatureOn(siteCfg, "referral")
    ? String(body.referralCode || "").trim().toUpperCase()
    : "";
  const referrer = refCode ? await findCustomerByReferralCode(refCode) : undefined;
  if (refCode && !referrer) {
    return NextResponse.json(
      { error: `ไม่พบโค้ดเพื่อนแนะนำ "${refCode}" — เช็คตัวสะกดอีกครั้ง หรือเอาติ๊กออกถ้าไม่มีโค้ดนะคะ` },
      { status: 400 }
    );
  }
  if (!name || !phone || cats.filter((c: { name: string }) => c.name.trim()).length === 0) {
    return NextResponse.json(
      { error: "กรอกชื่อ เบอร์โทร และชื่อน้องแมวอย่างน้อย 1 ตัว" },
      { status: 400 }
    );
  }

  let customer;
  try {
    customer = await registerCustomerFromLine({
      lineUserId,
      name,
      phone,
      email: email || undefined,
      birthday: birthday || undefined,
      referralSource: referralSource || undefined,
      address: address || undefined,
      addressMapUrl: addressMapUrl || undefined,
      postalCode: postalCode || undefined,
      marketingConsent,
      cats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("register failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!customer) {
    return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ" }, { status: 500 });
  }

  // ระดับลูกค้า (นับครั้งที่มา/ยอดสะสมจากทั้งร้าน) — ไม่ต้องให้ลูกค้ารอ คิดหลังตอบกลับ
  const customerId = customer.id;
  runAfterResponse("register tier recalc", () => recalculateCustomerTier(customerId));

  // ── แจ้งเตือนลูกค้าสมัครใหม่ ──
  try {
    const catNames = customer.cats.map((c) => c.name).filter(Boolean).join(", ") || "-";
    sendTelegramLater(
      formatBookingTelegram("🆕 ลูกค้าสมัครสมาชิกใหม่", {
        ชื่อ: customer.name,
        เบอร์: customer.phone || "-",
        น้องแมว: catNames,
        ช่องทาง: referralSource || "-",
      })
    );
  } catch (e) {
    console.error("new customer notify failed:", e);
  }

  // ── ชวนเพื่อน: ผูกคนชวน + ออกคูปองให้ทั้งคู่ทันที ──
  // ใช้โค้ดได้ครั้งเดียวต่อบัญชี (referredBy) และห้ามใช้โค้ดตัวเอง
  let referredOk = false;
  if (referrer && referrer.id !== customer.id && !customer.referredBy) {
    try {
      await setReferredBy(customer.id, referrer.id);
      referredOk = true;
      const mine = await listCustomerCoupons(customer.id);
      if (!mine.some((c) => c.reason.includes(REFERRAL_TAG))) {
        await issueCoupon({
          customerId: customer.id,
          amount: reward.amount,
          reason: `🎁 สมัครด้วยโค้ด${REFERRAL_TAG}`,
          expiresInDays: reward.expiresInDays,
        });
        await issueCoupon({
          customerId: referrer.id,
          amount: reward.amount,
          reason: `🎉 ${REFERRAL_TAG}: ${customer.name} สมัครด้วยโค้ดของคุณ`,
          expiresInDays: reward.expiresInDays,
        });
        const referrerLine = referrer.lineUserId;
        if (referrerLine) {
          runAfterResponse("referral push", () =>
            pushLineMessage(referrerLine, [
              {
                type: "text",
                text: `🎉 เพื่อนสมัครด้วยโค้ดของคุณแล้ว!\nคุณได้รับคูปองส่วนลด ${reward.amount}฿ เก็บไว้ในกระเป๋าคูปองแล้วนะคะ 🧡 (ใช้ได้ ${reward.expiresInDays} วัน)`,
              },
            ])
          );
        }
      }
      sendTelegramLater(
        formatBookingTelegram(`🎁 สมัครด้วยโค้ดเพื่อนแนะนำ (คูปอง ${reward.amount}฿ x2)`, {
          คนชวน: referrer.name,
          คนถูกชวน: customer.name,
          โค้ด: refCode,
        })
      );
    } catch (e) {
      console.error("referral link failed:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    referredOk,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      cats: customer.cats.map((cat) => {
        const rest = { ...cat };
        delete rest.staffPrivateNote;
        return rest;
      }),
      tier: customer.tier,
    },
  });
}
