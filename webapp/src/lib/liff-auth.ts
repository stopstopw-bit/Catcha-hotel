import { getLineCredentials } from "./line-config";

export type VerifiedLiffIdentity = { lineUserId: string; displayName: string };

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

  const creds = await getLineCredentials();
  const liffId = creds?.liffId;
  // LIFF ID รูปแบบ "<channelId>-<suffix>" — ส่วนหน้าคือ channel id ที่ใช้เป็น client_id
  const clientId = liffId?.split("-")[0];
  if (!clientId) return null;

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sub?: string; name?: string; aud?: string };
    if (!data.sub) return null;
    // aud ต้องเป็น channel ของเราเท่านั้น — กันเอา token จาก LIFF app อื่นมาสวมรอย
    if (data.aud && data.aud !== clientId) return null;
    return { lineUserId: data.sub, displayName: data.name || "" };
  } catch {
    return null;
  }
}
