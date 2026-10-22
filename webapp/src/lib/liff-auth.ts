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

/**
 * ตรวจ LIFF ID token กับ LINE ตรงๆ ก่อนเชื่อว่าเป็นลูกค้าคนนั้นจริง
 *
 * lineUserId ที่ client ส่งมาเป็นแค่ข้อความธรรมดา ใครใส่ของใครก็ได้ ส่วน ID token
 * เป็น JWT ที่ LINE เซ็นให้ตอนล็อกอิน LIFF สำเร็จ ปลอมไม่ได้ — เราจึงเอา token
 * ไปถาม LINE ว่าเป็นของใคร แล้วค่อยเชื่อผลที่ LINE ตอบกลับมา
 */
export async function verifyLiffIdToken(
  idToken: string
): Promise<VerifiedLiffIdentity | null> {
  if (!idToken || typeof idToken !== "string") return null;

  const channels = await allowedChannels();
  if (channels.length === 0) {
    console.warn("[liff-auth] ยังไม่ได้ตั้ง LIFF ID — ตรวจ token ไม่ได้");
    return null;
  }
  // aud ต้องเป็น channel ของเราเท่านั้น — กันเอา token จาก LIFF app อื่นมาสวมรอย
  const aud = peekAudience(idToken);
  if (!channels.includes(aud)) {
    console.warn(`[liff-auth] token มาจาก channel ${aud || "?"} ไม่ตรงกับที่ตั้งไว้ (${channels.join(", ")})`);
    return null;
  }

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: aud }),
    });
    if (!res.ok) {
      console.warn(`[liff-auth] LINE ตรวจ token ไม่ผ่าน ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    const data = (await res.json()) as { sub?: string; name?: string; aud?: string };
    if (!data.sub) return null;
    if (data.aud && data.aud !== aud) return null;
    return { lineUserId: data.sub, displayName: data.name || "" };
  } catch (e) {
    console.warn("[liff-auth] เรียก LINE ไม่สำเร็จ", e);
    return null;
  }
}
