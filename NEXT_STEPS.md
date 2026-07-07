# 📌 CatCha Hotel — สถานะงาน & ขั้นต่อไป

อัปเดตล่าสุด: 2026-07-07 (ทำต่อจากมือถือได้)

## กำลังสร้างอะไร
ระบบ **จองคิว + เตือนยืนยัน** สำหรับ CatCha Hotel (โรงแรมแมว + อาบน้ำ/กรูมมิ่ง)
สเปคเต็มอยู่ใน [SKILL_BRIEF.md](SKILL_BRIEF.md) — เลือกทำฟีเจอร์นี้ก่อนจาก 5 เรื่อง

**Stack ที่เลือก:** Google Apps Script (backend/เว็บ/ตั้งเวลา) + LINE Messaging API + Google Calendar

## ✅ เฟส 1 — หน้าตา (เสร็จแล้ว)
- `webapp/index.html` = หน้าเว็บจองคิว (responsive เปิดได้มือถือ+คอม) ธีม cozy minimal ใส่โลโก้ร้านจริง
- ฟอร์มปรับตามบริการ: อาบน้ำ (รอบ 9.30/12.30/15.30) · ห้องพัก (เช็คอิน/เช็คเอาท์)
- การ์ด LINE 2 แบบ (อาบน้ำ / โรงแรม) คำพูดโทนสุภาพอบอุ่น + ปุ่ม "ดูเส้นทาง" (ลิงก์ Maps ร้านจริง)
- ห้องพัก: ลูกค้าเลือก "เวลาเช็คอิน" เองในการ์ด แล้วเด้งกลับมาที่ตารางเรา
- ตัวอย่างสด (Artifact): https://claude.ai/code/artifact/045f24a5-103b-4377-aa71-651b526fa7e7

## 🔜 เฟส 2 — ต่อ Google Calendar จริง (โค้ดเสร็จแล้ว รอเจ้าของติดตั้ง)
พอกดบันทึกจอง → สร้าง event ใน Google Calendar + เชิญอีเมลเจ้าของ 2 คน (ต่างคนเห็นในปฏิทินตัวเอง)

**อีเมลเจ้าของที่รับเชิญเข้านัด:** Chatchanok.than@gmail.com · pitchapawong.pw@gmail.com
(บัญชีที่รัน Apps Script/ปฏิทินหลัก = Stopstop.w@gmail.com)

**โค้ดที่เขียนไว้แล้ว:**
- `apps-script/Code.gs` — หลังบ้าน: saveBooking() สร้างนัด Calendar + เชิญ 2 คน, เก็บลง Google Sheet
- `webapp/index.html` — ต่อสายเรียก google.script.run.saveBooking แล้ว (ถ้าเปิดผ่านเว็บแอปจริงจะยิงหลังบ้าน; เปิดไฟล์เฉยๆ = โหมดตัวอย่าง)
- `apps-script/SETUP.md` — **คู่มือติดตั้งทีละสเต็ป** ← เจ้าของทำตามนี้

**ติดตั้งแล้ว:** สร้าง Apps Script + Google Sheet + deploy เป็น Web app เรียบร้อย
**Web app URL:** https://script.google.com/macros/s/AKfycbww2AwCVL8BHKAbzqhUfNOfgC38dUYMkEtyG54J7IsSdqyUnELUsfBIcqbCstuteQA9/exec
(deploy ด้วยบัญชี Stopstop.w · Execute as: Me · Access: Anyone)

**หมายเหตุแก้บั๊ก:** getCalendarById('primary') คืน null → เปลี่ยนเป็น getDefaultCalendar() แล้ว
ถ้าแก้ Code.gs ต้อง Deploy → Manage deployments → ✏️ → Version: New version ทุกครั้ง

**ค้างที่:** ทดสอบจอง → ยืนยันว่านัดเด้งเข้า Google Calendar สำเร็จ

## เฟสถัดไป (ยังไม่ทำ)
- เฟส 3: ต่อ LINE (ส่งการ์ด Flex + ปุ่มยืนยัน LIFF) — ต้องเปิด Messaging API ที่ LINE OA @catchahotel
- เฟส 4: ตั้งเวลายิงเตือนอัตโนมัติเที่ยงทุกวัน + ทดสอบใช้จริง

## 5 เรื่องที่จะทำต่อในอนาคต (ตัดไว้ทำทีหลัง)
สะสมแต้ม · ประวัติน้องแมว(รูปถาวร) · การตลาด/ยิงแอด · บัญชีรายรับรายจ่าย
