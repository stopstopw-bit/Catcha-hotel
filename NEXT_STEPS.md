# 📌 CatCha Hotel — เริ่มใหม่ v2

อัปเดต: 2026-07-07

## โปรเจกต์ใหม่
เว็บแยก **Next.js** ในโฟลเดอร์ `web/` — ทิ้ง Apps Script เดิม

| ส่วน | URL | ผู้ใช้ |
|------|-----|--------|
| หน้าลูกค้า | `/app` | ลูกค้า (LINE LIFF login) |
| หลังบ้าน | `/admin` | เจ้าของ / พนักงาน (รหัส login) |

## สเปคเต็ม
`DESIGN_BRIEF.md`

## เจ้าของทำแค่นี้ (ไม่ต้องแตะโค้ด)
1. Deploy `web/` ขึ้น **Vercel** (ฟรี) — ดู `web/README.md`
2. ใส่ LIFF ID + รหัสหลังบ้านใน Vercel Settings
3. ผูก LIFF กับ LINE OA @catchahotel

## สถานะ
- ✅ UI หน้าลูกค้า + หลังบ้าน (responsive, ไทย/อังกฤษ, โทนเหลือง-น้ำตาล)
- 🔜 ต่อ Supabase + Calendar + LINE API จริง

## โทรศัพท์ร้าน (อัปเดต)
080-549-8969 · 095-324-6989
