/** รูปโปสเตอร์ของฟอร์มลูกค้า (ตั้งในหลังบ้าน › การ์ด & ฟอร์ม) — เรียงต่อกันตามลำดับที่ร้านตั้ง */
export function FormPosters({ images, alt, className = "" }: { images: string[]; alt: string; className?: string }) {
  if (images.length === 0) return null;
  return (
    <div className={`space-y-3 ${className}`}>
      {images.map((src, i) => (
        <div key={`${i}-${src.slice(-24)}`} className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={images.length > 1 ? `${alt} (${i + 1})` : alt} className="block h-auto w-full" />
        </div>
      ))}
    </div>
  );
}
