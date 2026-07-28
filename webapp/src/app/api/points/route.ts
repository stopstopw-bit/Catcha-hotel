import { NextRequest, NextResponse } from "next/server";
import { getAccount, redeemReward, addPoints, deletePointsHistoryEntry } from "@/lib/points-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage, buildPointsAwardFlex } from "@/lib/line";
import { getSiteConfig } from "@/lib/config-store";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/** /api/points เปิดให้แอปลูกค้าเรียกตรงๆ ได้ (ดูแต้ม/แลกรางวัลตัวเอง) — แต่ปรับแต้มมือ (admin_add)
 *  ต้องเป็นพนักงานหลังบ้านเท่านั้น เช็คในนี้เอง เพราะ middleware ปล่อยผ่านทั้ง path */
async function isAdmin(req: NextRequest) {
  return !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
}

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const displayName = req.nextUrl.searchParams.get("displayName") || "";
  const customerId = req.nextUrl.searchParams.get("customerId") || undefined;
  const account = await getAccount(lineUserId, displayName, customerId);

  return NextResponse.json({
    points: account.points,
    history: account.history,
    displayName: account.displayName,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { lineUserId, rewardId, displayName } = body;

  // ลบประวัติแต้ม 1 รายการ (กดผิด/ลงซ้ำ) — ปรับยอดคงเหลือย้อนกลับให้เอง ต้องเป็นพนักงานเท่านั้น
  if (body.action === "delete_history") {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const entryId = String(body.entryId || "").trim();
    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }
    const res = await deletePointsHistoryEntry(entryId);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, points: res.points });
  }

  // เพิ่ม/ปรับแต้มด้วยมือจากหลังบ้าน (เช่น รีวิวแล้วรับแต้มฟรี) — บันทึกเหตุผลในประวัติ
  // route นี้เปิดให้แอปลูกค้าเรียกตรงๆ ได้ (ดูแต้ม/แลกรางวัล) แต่ action นี้ปรับแต้มลูกค้าคนไหนก็ได้
  // ตามใจ ต้องเป็นพนักงานหลังบ้านเท่านั้น ไม่งั้นใครก็เติมแต้มให้ตัวเองฟรีได้
  if (body.action === "admin_add") {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const uid = String(lineUserId || "").trim();
    const amount = Math.round(Number(body.amount) || 0);
    const reason = String(body.reason || "").trim() || "แต้มพิเศษจากร้าน";
    if (!uid || amount === 0) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // ดูตัวอย่างการ์ดก่อนส่งจริง — ยังไม่เติมแต้ม ไม่ส่งอะไรทั้งนั้น
    if (body.preview === true) {
      const cfg = await getSiteConfig();
      const cur = await getAccount(uid, displayName || "");
      return NextResponse.json({
        ok: true,
        preview: [
          buildPointsAwardFlex(
            {
              customerName: cur.displayName || displayName || "ลูกค้า",
              pointsAwarded: amount,
              reason,
              totalPoints: cur.points + amount,
              shopName: cfg.business.name,
            },
            cfg.cards?.pointsAward
          ),
        ],
      });
    }

    const label = amount > 0 ? `🎁 ${reason}` : `ปรับแต้ม: ${reason}`;
    const acc = await addPoints(uid, amount, label, label, displayName || "");
    await sendTelegram(
      formatBookingTelegram(
        amount > 0 ? "🎁 เพิ่มแต้มให้ลูกค้า (มือ)" : "➖ ปรับลดแต้มลูกค้า (มือ)",
        {
          ลูกค้า: acc.displayName || uid,
          แต้ม: `${amount > 0 ? "+" : ""}${amount}`,
          เหตุผล: reason,
          แต้มคงเหลือ: String(acc.points),
        }
      )
    );
    // ปกติเงียบ ๆ — เพิ่มแต้มหลังบ้านไม่ต้องรบกวนลูกค้า (และไม่เสียโควตาข้อความ)
    // จะแจ้งก็ต่อเมื่อกดติ๊ก "แจ้งลูกค้าทาง LINE" ในหน้าหลังบ้าน
    if (amount > 0 && body.notify === true) {
      try {
        const cfg = await getSiteConfig();
        await pushLineMessage(uid, [
          buildPointsAwardFlex(
            {
              customerName: acc.displayName || displayName || "ลูกค้า",
              pointsAwarded: amount,
              reason,
              totalPoints: acc.points,
              shopName: cfg.business.name,
            },
            cfg.cards?.pointsAward
          ),
        ]);
      } catch {
        /* ไม่มี LINE ก็ไม่เป็นไร — แต้มถูกบันทึกแล้ว */
      }
    }
    return NextResponse.json({ ok: true, points: acc.points });
  }

  if (!lineUserId || !rewardId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const result = await redeemReward(
    lineUserId,
    rewardId,
    displayName || "",
    body.customerId ? String(body.customerId) : undefined
  );

  if (!result.ok) {
    const msg =
      result.error === "insufficient_points"
        ? "แต้มไม่พอ"
        : "รางวัลไม่ถูกต้อง";
    return NextResponse.json({ error: result.error, message: msg }, { status: 400 });
  }

  await sendTelegram(
    formatBookingTelegram("🎁 ลูกค้าแลกแต้ม", {
      ลูกค้า: result.account.displayName || lineUserId,
      รางวัล: result.reward.reward.th,
      คูปอง: result.couponCode,
      แต้มคงเหลือ: String(result.account.points),
    })
  );

  return NextResponse.json({
    ok: true,
    points: result.account.points,
    couponCode: result.couponCode,
    reward: result.reward,
    history: result.account.history,
  });
}
