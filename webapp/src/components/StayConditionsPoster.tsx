/** โปสเตอร์ "เงื่อนไขสำคัญในการเข้าพัก" — หน้าแรกของฟอร์มข้อมูลน้องก่อนเข้าพัก (ก่อนเริ่มตอบคำถาม) */
export const STAY_CONDITIONS_POSTER = "/info/stay-conditions.jpg";

export function StayConditionsPoster({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={STAY_CONDITIONS_POSTER}
        alt="เงื่อนไขสำคัญในการเข้าพัก — รับเฉพาะแมวเลี้ยงระบบปิด, สุขภาพแข็งแรงไม่มีโรคติดต่อ, วัคซีนครบและหยดยาเห็บหมัดภายใน 1 เดือน, แจ้งประวัติสุขภาพและยาประจำตัว, นำอุปกรณ์ของน้องมาเอง, ไม่รับแมวก้าวร้าว, อัปเดตรูปทุกวัน, ขอสงวนสิทธิ์ปฏิเสธการให้บริการโดยไม่คืนมัดจำ, กรณีฉุกเฉินพาไปพบสัตวแพทย์, การเข้าพักถือว่ายอมรับเงื่อนไข"
        width={1122}
        height={1402}
        className="block h-auto w-full"
      />
    </div>
  );
}
