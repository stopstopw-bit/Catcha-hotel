# 📌 CatCha Hotel — สถานะงาน & ขั้นต่อไป

อัปเดตล่าสุด: 2026-07-07

## กำลังสร้างอะไร
ระบบ **จองคิว + เตือนยืนยัน** สำหรับ CatCha Hotel (โรงแรมแมว + อาบน้ำ/กรูมมิ่ง)

**Stack:** Google Apps Script + Google Calendar + LINE Messaging API

## ✅ เฟส 1 — หน้าเว็บจอง (เสร็จแล้ว)
- `webapp/index.html` — responsive, ฟอร์มอาบน้ำ/ห้องพัก, ตัวอย่างการ์ด LINE

## ✅ เฟส 2 — Google Calendar (ใช้งานได้แล้ว)
- บันทึกจอง → ลงปฏิทินร่วม **Catcha Hotel**
- แชร์ให้ Chutchanok.than@gmail.com + pitchapawong.pw@gmail.com
- **Web app:** https://script.google.com/macros/s/AKfycbww2AwCVL8BHKAbzqhUfNOfgC38dUYMkEtyG54J7IsSdqyUnELUsfBIcqbCstuteQA9/exec

## 🔜 เฟส 3–4 — LINE + เตือนอัตโนมัติ (โค้ดเสร็จ รอติดตั้ง LINE)
**ไฟล์ใหม่:**
- `apps-script/Line.gs` — ส่ง Flex, เตือน 12:00 น., ปุ่มยืนยัน
- `apps-script/Confirm.html` — หน้า LIFF ให้ลูกค้ายืนยัน
- `apps-script/SETUP_LINE.md` — **คู่มือติดตั้ง LINE ทีละสเต็ป**

**ฟีเจอร์:**
- ปุ่ม 📨 ส่งการ์ด → ยิง LINE Flex จริง (ต้องใส่ LINE User ID ในช่องติดต่อ)
- ลูกค้ากดยืนยันใน LIFF → อัปเดตสถานะ + ปฏิทิน ✅
- ตารางนัดโหลดจากชีตจริง (ไม่ใช่ demo)
- `sendDailyReminders()` + `setupTriggers()` — เตือนอัตโนมัติเที่ยงทุกวัน

**เจ้าของทำต่อ:** อ่าน `apps-script/SETUP_LINE.md` → ใส่ Channel token + LIFF ID → Deploy ใหม่

## เฟสถัดไป (ยังไม่ทำ)
- Webhook เก็บ LINE User ID อัตโนมัติเมื่อลูกค้าทัก OA
- สะสมแต้ม · ประวัติน้องแมว · การตลาด · บัญชี
