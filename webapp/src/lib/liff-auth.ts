import { getLineCredentials, normalizeLiffId } from "./line-config";

export type VerifiedLiffIdentity = { lineUserId: string; displayName: string };

/** LIFF ID รูปแบบ "<channelId>-<suffix>" — ส่วนหน้าคือ channel id ที่ใช้เป็น client_id */
function channelOf(liffId?: string): string {
  return normalizeLiffId(liffId).split("-")[0] || "";
}

/**
 * channel ที่ยอมรับ token — LIFF ที่ตั้งในหลังบ้าน (ฐานข้อมูล) + NEXT_PUBLIC_LIFF_ID ใน env
 * (+ LINE_LOGIN_CHANNEL_ID ถ้าตั้งไว้)
 *
 * เดิมตรวจกับ LIFF ตัวเดียว (ฐานข้อมูลก่อน env) แต่หน้าแอปเปิด LIFF จาก env ก่อน
 * ถ้าสองค่านี้คนละ channel token จะตรวจไม่ผ่านทุกครั้ง → ไม่ได้คุกกี้เซสชัน
 * ลูกค้าบันทึกโปรไฟล์ไม่ได้ ("lineUserId required") / แนบรูปบัตรไม่สำเร็จ
 */
async function allowedChannels(): Promise<string[]> {
  const creds = await getLineCredentials().catch(() => null);
  const ids = [
    channelOf(creds?.liffId),
    channelOf(process.env.NEXT_PUBLIC_LIFF_ID),
    ...(process.env.LINE_LOGIN_CHANNEL_ID || "").split(","),
  ]
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x));
  return [...new Set(ids)];
}

/** อ่าน aud จาก JWT แบบยังไม่ตรวจลายเซ็น — ใช้แค่เลือก channel ก่อนส่งให้ LINE ตรวจจริง */
function peekAudience(idToken: string): string {
  try {
    const part = idToken.split(".")[1] || "";
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const aud = (JSON.parse(json) as { aud?: string | string[] }).aud;
    return String(Array.isArray(aud) ? aud[0] : aud || "");
  } catch {
    return "";
  }
}

export type LiffVerifyResult =
  | { ok: true; identity: VerifiedLiffIdentity }
  | { ok: false; reason: string };

/**
 * ตรวจ LIFF ID token กับ LINE ตรงๆ ก่อนเชื่อว่าเป็นลูกค้าคนนั้นจริง
 *
 * lineUserId ที่ client ส่งมาเป็นแค่ข้อความธรรมดา ใครใส่ของใครก็ได้ ส่วน ID token
 * เป็น JWT ที่ LINE เซ็นให้ตอนล็อกอิน LIFF สำเร็จ ปลอมไม่ได้ — เราจึงเอา token
 * ไปถาม LINE ว่าเป็นของใคร แล้วค่อยเชื่อผลที่ LINE ตอบกลับมา
 *
 * ตรวจไม่ผ่านคืน reason สั้นๆ ไว้โชว์เป็นรหัสบนจอลูกค้า + log ไว้ดูใน Vercel
 */
export async function verifyLiffIdTokenDetailed(idToken: string): Promise<LiffVerifyResult> {
  if (!idToken || typeof idToken !== "string") return { ok: false, reason: "no_token" };

  const channels = await allowedChannels();
  if (channels.length === 0) {
    console.warn("[liff-auth] ยังไม่ได้ตั้ง LIFF ID — ตรวจ token ไม่ได้");
    return { ok: false, reason: "no_liff_config" };
  }
  // aud ต้องเป็น channel ของเราเท่านั้น — กันเอา token จาก LIFF app อื่นมาสวมรอย
  const aud = peekAudience(idToken);
  if (!channels.includes(aud)) {
    console.warn(`[liff-auth] token มาจาก channel ${aud || "?"} ไม่ตรงกับที่ตั้งไว้ (${channels.join(", ")})`);
    return { ok: false, reason: `channel_${aud || "unknown"}` };
  }

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: aud }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[liff-auth] LINE ตรวจ token ไม่ผ่าน ${res.status}: ${text}`);
      const desc = /"error_description"\s*:\s*"([^"]+)"/.exec(text)?.[1] || "";
      return { ok: false, reason: `line_${res.status}${desc ? `_${desc.replace(/\W+/g, "_").slice(0, 40)}` : ""}` };
    }
    const data = (await res.json()) as { sub?: string; name?: string; aud?: string };
    if (!data.sub) return { ok: false, reason: "no_sub" };
    if (data.aud && data.aud !== aud) return { ok: false, reason: "aud_mismatch" };
    return { ok: true, identity: { lineUserId: data.sub, displayName: data.name || "" } };
  } catch (e) {
    console.warn("[liff-auth] เรียก LINE ไม่สำเร็จ", e);
    return { ok: false, reason: "line_unreachable" };
  }
}

export async function verifyLiffIdToken(
  idToken: string
): Promise<VerifiedLiffIdentity | null> {
  const r = await verifyLiffIdTokenDetailed(idToken);
  return r.ok ? r.identity : null;
}

/**
 * ทางสำรองเมื่อไม่มี ID token (LIFF app ไม่ได้ติ๊ก scope "openid" — getIDToken() คืน null)
 * ใช้ access token ของ LIFF แทน: ถาม LINE ว่า token นี้ออกให้ channel ไหน (ต้องเป็นของร้านเรา)
 * แล้วดึงโปรไฟล์ด้วย token นั้น — userId มาจาก LINE โดยตรง client ปลอมไม่ได้เหมือนกัน
 */
export async function verifyLiffAccessTokenDetailed(accessToken: string): Promise<LiffVerifyResult> {
  if (!accessToken || typeof accessToken !== "string") return { ok: false, reason: "no_token" };
  const channels = await allowedChannels();
  if (channels.length === 0) return { ok: false, reason: "no_liff_config" };
  try {
    const v = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!v.ok) {
      const text = await v.text().catch(() => "");
      console.warn(`[liff-auth] LINE ตรวจ access token ไม่ผ่าน ${v.status}: ${text}`);
      return { ok: false, reason: `line_at_${v.status}` };
    }
    const info = (await v.json()) as { client_id?: string; expires_in?: number };
    const clientId = String(info.client_id || "");
    if (!channels.includes(clientId)) {
      console.warn(`[liff-auth] access token มาจาก channel ${clientId || "?"} ไม่ตรงกับที่ตั้งไว้ (${channels.join(", ")})`);
      return { ok: false, reason: `channel_${clientId || "unknown"}` };
    }
    if (!info.expires_in || info.expires_in <= 0) return { ok: false, reason: "line_at_expired" };
    const p = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!p.ok) {
      console.warn(`[liff-auth] ดึงโปรไฟล์ด้วย access token ไม่ได้ ${p.status}`);
      return { ok: false, reason: `line_profile_${p.status}` };
    }
    const prof = (await p.json()) as { userId?: string; displayName?: string };
    if (!prof.userId) return { ok: false, reason: "no_sub" };
    return { ok: true, identity: { lineUserId: prof.userId, displayName: prof.displayName || "" } };
  } catch (e) {
    console.warn("[liff-auth] เรียก LINE ไม่สำเร็จ", e);
    return { ok: false, reason: "line_unreachable" };
  }
}
