/**
 * fetch ฝั่งแอปลูกค้า — ถ้าเซิร์ฟเวอร์ตอบว่ายังไม่มีคุกกี้เซสชัน (code "no_session")
 * ให้ LiffProvider แลก LIFF ID token เป็นคุกกี้ใหม่ แล้วยิงซ้ำให้อีกครั้งเดียว
 * ลูกค้าจะได้ไม่เจอ "บันทึกไม่สำเร็จ" เพราะคุกกี้หาย/ตอนเปิดแอปแลกไม่ทัน
 */
let refreshSession: (() => Promise<boolean>) | null = null;

export function setCustomerSessionRefresher(fn: (() => Promise<boolean>) | null) {
  refreshSession = fn;
}

export async function customerFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401 || !refreshSession) return res;
  const data = await res.clone().json().catch(() => null);
  if (data?.code !== "no_session") return res;
  if (!(await refreshSession().catch(() => false))) return res;
  return fetch(input, init);
}
