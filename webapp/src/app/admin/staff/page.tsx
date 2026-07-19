"use client";

import { StaffSection } from "@/components/StaffSection";

/** 👥 พนักงาน — สร้างรหัสให้พนักงานและเลือกว่าให้เห็นเมนูไหนบ้าง */
export default function AdminStaffPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">👥 พนักงาน</h1>
      <StaffSection />
    </div>
  );
}
