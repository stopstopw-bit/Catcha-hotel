import Image from "next/image";

/**
 * หน้าจอรอโหลดของแอปลูกค้า — ใช้แทนข้อความ "กำลังโหลด…" เปล่าๆ ทุกจุด
 * ให้เห็นโลโก้ร้านแทนจอว่างระหว่างรอ API (LIFF บนมือถือบางทีโหลดช้า)
 */
export function LoadingScreen({
  message = "กำลังโหลดข้อมูล...",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="h-24 w-24 animate-bounce overflow-hidden rounded-full border border-catcha-line bg-[#fbf3e0] shadow-catcha">
        <Image
          src="/logo.jpg"
          alt="CatCha Hotel"
          width={96}
          height={96}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      <div>
        <p className="text-sm font-extrabold tracking-wide text-catcha-chocolate">
          CatCha Hotel
        </p>
        <p className="mt-1 text-xs text-brown-soft">{message}</p>
      </div>
      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-honey-deep [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-honey-deep [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-honey-deep" />
      </div>
    </div>
  );
}
