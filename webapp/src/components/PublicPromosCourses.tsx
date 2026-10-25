import { getActivePromos } from "@/lib/promos-store";
import { listPackageOffers, type PackageOffer } from "@/lib/package-shop-store";

/**
 * โปรโมชั่น + คอร์สบนหน้าเว็บ — ดึงจากที่ร้านตั้งในหลังบ้าน (โปรแบบ display + คอร์สที่เปิดขาย)
 * โปรเฉพาะลูกค้า (kind "customer") ไม่โชว์ เพราะเป็นโปรเจาะกลุ่มในแอป
 * ไม่มีโปร/คอร์สเลย หรือดึงข้อมูลไม่ได้ → ซ่อนทั้งส่วน
 */

const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

function offerDetail(o: PackageOffer): string[] {
  if (o.itemLabels?.length) return o.itemLabels;
  if (o.kind === "credit") {
    return [
      `รวมเครดิต ${(o.price + o.creditBonus).toLocaleString()} บาท` +
        (o.creditBonus > 0 ? ` (รับเพิ่มฟรี ${o.creditBonus.toLocaleString()})` : ""),
    ];
  }
  if (o.kind === "nights") {
    const per = o.totalUses > 0 ? ` · ตกคืนละ ${Math.round(o.price / o.totalUses).toLocaleString()}฿` : "";
    return [`เข้าพักได้ ${o.totalUses} คืน${o.roomLabel ? ` ${o.roomLabel}` : ""}${per}`];
  }
  const per = o.totalUses > 0 ? ` · ตกครั้งละ ${Math.round(o.price / o.totalUses).toLocaleString()}฿` : "";
  return [`ใช้ได้ ${o.totalUses} ครั้ง${per}`];
}

function thaiDate(iso: string) {
  const d = new Date(`${iso}T00:00:00+07:00`);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default async function PublicPromosCourses() {
  const [promos, offers] = await Promise.all([
    getActivePromos(new Date(), "display").catch(() => []),
    listPackageOffers(true).catch(() => []),
  ]);
  if (promos.length === 0 && offers.length === 0) return null;

  return (
    <section id="promos" className="mt-14">
      <h2 className="text-center text-xl font-extrabold text-catcha-chocolate">
        🎁 โปรโมชั่น & คอร์สสุดคุ้ม
      </h2>
      <p className="mt-2 text-center text-sm text-brown-soft">
        โปรล่าสุดจากร้าน · ซื้อคอร์สหรือรับโปรผ่าน LINE @catchahotel
      </p>

      {promos.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm"
            >
              {p.imageUrl && (
                <a href={p.imageUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.title.th} loading="lazy" className="h-auto w-full" />
                </a>
              )}
              <div className="p-4">
                <p className="text-sm font-extrabold text-catcha-chocolate">
                  {p.discountPercent ? `🔥 ลด ${p.discountPercent}% · ` : ""}
                  {p.title.th}
                </p>
                {p.body.th && (
                  <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-brown-soft">
                    {p.body.th}
                  </p>
                )}
                {p.until && (
                  <p className="mt-2 text-[11px] font-bold text-latte-deep">ถึง {thaiDate(p.until)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {offers.length > 0 && (
        <>
          <h3 className="mt-8 text-center text-base font-extrabold text-catcha-chocolate">
            🎟️ คอร์สอาบน้ำ & แพ็กเกจเข้าพัก
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <div
                key={o.id}
                className="flex flex-col overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm"
              >
                {o.imageUrl && (
                  <div className="flex items-center justify-center bg-latte/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.imageUrl} alt={o.name} loading="lazy" className="max-h-64 w-full object-contain" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-extrabold text-catcha-chocolate">{o.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {offerDetail(o).map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-bold text-ok"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  {o.description && (
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-brown-soft">
                      {o.description}
                    </p>
                  )}
                  <p className="mt-auto pt-3 text-xl font-extrabold text-latte-deep">
                    {o.price.toLocaleString()}
                    <span className="text-sm"> บาท</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-5 text-center">
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-catcha-sm bg-latte-deep px-6 py-3 text-sm font-extrabold text-card shadow-catcha-sm"
        >
          💬 ทัก LINE ซื้อคอร์ส / รับโปร
        </a>
      </div>
    </section>
  );
}
