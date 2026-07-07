# 📱 เฟส 3–4 — ต่อ LINE + เตือนอัตโนมัติ

> ทำต่อจากเฟส 2 (Calendar ใช้งานได้แล้ว)
> LINE OA: **@catchahotel**

---

## สิ่งที่ระบบทำได้หลังติดตั้ง

1. **ส่งการ์ด Flex** เตือนลูกค้าก่อนนัด 1 วัน (ข้อความตามที่อนุมัติแล้ว)
2. **ปุ่มยืนยัน** เปิดหน้า LIFF → ลูกค้ากดยืนยัน → อัปเดตสถานะ + ปฏิทิน
3. **เตือนอัตโนมัติ** ทุกวัน 12:00 น. (เวลาไทย)
4. **หน้าเว็บจอง** โหลดนัดจริงจากชีต + ปุ่ม "ส่งการ์ด" ยิง LINE จริง

---

## สเต็ป 1 — เปิด LINE Messaging API

1. เข้า [LINE Developers Console](https://developers.line.biz/)
2. เลือก Provider → Channel ของ **@catchahotel** (Messaging API)
3. แท็บ **Messaging API** → กด **Issue** Channel access token (long-lived)
4. ก็อป **Channel access token** เก็บไว้

## สเต็ป 2 — สร้าง LIFF App (ปุ่มยืนยัน)

1. ใน Channel เดียวกัน → แท็บ **LIFF** → **Add**
2. ตั้งค่า:
   - **Size:** Full
   - **Endpoint URL:** Web app URL ของเรา + `?page=confirm`  
     เช่น `https://script.google.com/macros/s/...../exec?page=confirm`
   - **Scope:** profile (ถ้าต้องการ)
3. ก็อป **LIFF ID** (ตัวเลขยาว)

## สเต็ป 3 — วางโค้ดใน Apps Script

1. เปิด Apps Script ของชีต CatCha Hotel
2. ก็อปไฟล์ใหม่:
   - `Code.gs` (อัปเดต)
   - `Line.gs` (ไฟล์ใหม่ — กด + สร้าง Script ชื่อ `Line`)
   - `Confirm.html` (ไฟล์ HTML ใหม่)
   - `Index` (อัปเดตจาก `webapp/index.html`)
3. **Services (+)** → ตรวจว่ามี **Google Calendar API** แล้ว

## สเต็ป 4 — ตั้งค่า LINE ในสคริปต์

1. เลือกฟังก์ชัน **`setLineConfig`** → กด Run
2. ใส่พารามิเตอร์ในโค้ดชั่วคราว หรือรันจาก editor:

```javascript
function runLineSetup() {
  setLineConfig('ใส่_CHANNEL_ACCESS_TOKEN_ที่นี่', 'ใส่_LIFF_ID_ที่นี่');
  setupTriggers();
}
```

3. รัน **`runLineSetup`** (หรือ `setupTriggers` แยก)

## สเต็ป 5 — Deploy ใหม่

1. **Deploy → Manage deployments → ✏️ → New version → Deploy**
2. อัปเดต **LIFF Endpoint URL** ให้ตรงกับ URL deploy ล่าสุด

## สเต็ป 6 — ทดสอบ

1. จองคิวทดสอบ → ใส่ **LINE User ID** ในช่องติดต่อ (ขึ้นต้น `U` ยาว 33 ตัว)  
   *หา User ID ได้จาก LINE Official Account Manager → รายชื่อเพื่อน*
2. กด **📨 ส่งการ์ด** ในตาราง → ลูกค้าได้รับ Flex ใน LINE
3. ลูกค้ากดปุ่มยืนยัน → สถานะเปลี่ยนเป็น "ยืนยันแล้ว" + ปฏิทินอัปเดต

---

## ฟังก์ชันสำคัญใน Apps Script

| ฟังก์ชัน | ใช้เมื่อ |
|---------|---------|
| `setLineConfig(token, liffId)` | ตั้งค่า LINE ครั้งแรก |
| `setupTriggers()` | ตั้งเวลาเตือน 12:00 น. ทุกวัน |
| `sendReminderCard('B20260707-...')` | ส่งการ์ดให้จองเดียว |
| `sendDailyReminders()` | ทดสอบเตือนอัตโนมัติ (จองพรุ่งนี้ + รอยืนยัน) |
| `shareWithOwners()` | แชร์ปฏิทิน (เฟส 2) |

---

## ถ้าติดปัญหา

- **ส่งการ์ดไม่ได้** → ตรวจ Channel token + ลูกค้าต้องเป็นเพื่อน OA @catchahotel แล้ว
- **ปุ่มยืนยันไม่เปิด** → ตรวจ LIFF Endpoint URL ตรงกับ Web app URL
- **เตือนอัตโนมัติไม่ยิง** → รัน `setupTriggers()` อีกครั้ง + ดู Triggers ซ้ายมือ (นาฬิกา)
- **ตารางว่าง** → เปิดผ่าน Web app URL จริง (ไม่ใช่เปิดไฟล์ HTML ตรงๆ)

## เฟสถัดไป (ยังไม่ทำ)

- เก็บ LINE User ID อัตโนมัติจาก webhook เมื่อลูกค้าทัก OA
- แจ้งเจ้าของผ่าน LINE (ใส่ OWNER_LINE_IDS ใน Script Properties)
