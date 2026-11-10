# Supabase Setup — CatCha Hotel

## วิธีง่ายสุด (แนะนำ)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (ฟรี)
2. ใส่ 3 ค่าใน **Vercel → Settings → Environment Variables**:

| ตัวแปร | หาได้ที่ไหน (Supabase Dashboard) |
|--------|----------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role (secret) |
| `DATABASE_URL` | Settings → Database → Connection string → **URI** |

3. **Redeploy** บน Vercel
4. เข้า **Admin → 🚀 ติดตั้ง** (`/admin/setup`)
5. กด **⚡ สร้างตารางอัตโนมัติ** — เสร็จ!

หลังจากนั้นไป **Admin → ⚙️ ตั้งค่า** แก้รูป ราคา โปรได้เลย

---

## วิธีที่ 2 — Copy SQL เอง

ถ้าไม่ใส่ `DATABASE_URL`:

1. Admin → ติดตั้ง → กด **📋 Copy SQL**
2. Supabase → SQL Editor → วาง → Run

หรือเปิดไฟล์ `webapp/supabase/schema.sql` บน GitHub

---

## ทำไม Agent ทำให้ทั้งหมดไม่ได้?

- **Supabase / Vercel** ต้องใช้บัญชีของเจ้าของ (login + password)
- Agent ไม่มีสิทธิ์เข้าบัญชี Stopstop.w โดยตรง
- หลังใส่ env 3 ตัวแล้ว → กดปุ่มเดียวใน Admin สร้างตารางให้เอง

---

## ทดสอบ

- Admin → ติดตั้ง → ต้องขึ้น ✅ พร้อมใช้งาน
- จองใหม่ → ดูตาราง `bookings` ใน Supabase Table Editor

---

## ย้ายไปอยู่โปรเจกต์ Supabase เดียวกับระบบอื่น (ประหยัดค่าโปรเจกต์)

ร้านเก็บตารางใน "ห้อง" (Postgres schema) ของตัวเองได้ เช่นห้อง `catcha` ในโปรเจกต์ของ PetFlow
ตารางไม่ปนกับของระบบอื่น รูปอยู่ bucket `catcha-media`

1. ในโปรเจกต์ปลายทาง: **Project Settings → Data API → Exposed schemas** เพิ่ม `catcha` → Save
2. Vercel ของ CatCha เพิ่ม `MOVE_TO_SUPABASE_URL` + `MOVE_TO_SUPABASE_SERVICE_ROLE_KEY` (ของปลายทาง) → Redeploy
3. หลังบ้าน → ติดตั้ง → **คัดลอกข้อมูลไปฐานใหม่** (เว็บยังใช้ฐานเดิม กดซ้ำได้ ดูจำนวนให้ตรงทุกตาราง)
4. ตอนสลับ: กดคัดลอกอีกรอบ แล้วใน Vercel เปลี่ยน
   `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` เป็นของปลายทาง และเพิ่ม `SUPABASE_DB_SCHEMA=catcha`
   (ถ้ามี `DATABASE_URL` เปลี่ยนเป็นของปลายทางด้วย) → Redeploy
5. ใช้งานได้ปกติแล้วค่อยลบ `MOVE_TO_*` และ pause โปรเจกต์เดิม — ย้อนกลับ = เปลี่ยน env กลับ
