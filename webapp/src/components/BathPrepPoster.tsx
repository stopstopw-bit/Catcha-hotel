/** โปสเตอร์ "ข้อมูลก่อนพาน้องแมวมาอาบน้ำ" — หน้าแรกของฟอร์มประวัติก่อนอาบน้ำ (ก่อนเริ่มตอบคำถาม) */
export const BATH_PREP_POSTER = "/catalog/grooming/bath-prep.jpg";

export function BathPrepPoster({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BATH_PREP_POSTER}
        alt="ข้อมูลก่อนพาน้องแมวมาอาบน้ำ — งดอาหาร 2-3 ชั่วโมง, แจ้งโรคประจำตัว, แจ้งถ้าน้องดุหรือตกใจง่าย, พามาในกระเป๋าหรือกรง, ถ้าพบเห็บหมัดอาจมีค่าใช้จ่ายเพิ่ม"
        width={1024}
        height={1536}
        className="block h-auto w-full"
      />
    </div>
  );
}
