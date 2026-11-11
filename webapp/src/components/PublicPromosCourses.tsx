import { getActivePromos } from "@/lib/promos-store";
import { listPackageOffers, type PackageOffer } from "@/lib/package-shop-store";
import PublicOfferCards, {
  type PublicOfferItem,
} from "@/components/PublicOfferCards";

/**
 * โปรโมชั่น + คอร์สบนหน้าเว็บ — ดึงจากที่ร้านตั้งในหลังบ้าน (โปรแบบ display + คอร์สที่เปิดขาย)
 * โปรเฉพาะลูกค้า (kind "customer") ไม่โชว์ เพราะเป็นโปรเจาะกลุ่มในแอป
 * การ์ดสั้นเท่ากัน กดดูรายละเอียดเต็มในแผ่นที่เด้งขึ้นมา (PublicOfferCards)
 * ไม่มีโปร/คอร์สเลย หรือดึงข้อมูลไม่ได้ → ซ่อนทั้งส่วน
 */

const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

function offerDetail(o: PackageOffer): string[] {
  if (o.itemLabels?.length) return o.itemLabels;
  if (o.kind === "credit") {
    return [
      `รวมเครดิต ${(o.price + o.creditBonus).toLocaleString()} บาท` +
        (o.creditBonus > 0
          ? ` (รับเพิ่มฟรี ${o.creditBonus.toLocaleString()})`
          : ""),
    ];
  }
  if (o.kind === "nights") {
    const per =
      o.totalUses > 0
        ? ` · ตกคืนละ ${Math.round(o.price / o.totalUses).toLocaleString()}฿`
        : "";
    return [
      `เข้าพักได้ ${o.totalUses} คืน${o.roomLabel ? ` ${o.roomLabel}` : ""}${per}`,
    ];
  }
  const per =
    o.totalUses > 0
      ? ` · ตกครั้งละ ${Math.round(o.price / o.totalUses).toLocaleString()}฿`
      : "";
  return [`ใช้ได้ ${o.totalUses} ครั้ง${per}`];
}

function thaiDate(iso: string) {
  const d = new Date(`${iso}T00:00:00+07:00`);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
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
        <div className="mt-6">
          <PublicOfferCards
            lineUrl={LINE_URL}
            items={promos.map(
              (p): PublicOfferItem => ({
                id: p.id,
                title: p.title.th,
                imageUrl: p.imageUrl || undefined,
                chips: [],
                body: p.body.th || undefined,
                note: p.until ? `ถึง ${thaiDate(p.until)}` : undefined,
                badge: p.discountPercent
                  ? `ลด ${p.discountPercent}%`
                  : undefined,
              }),
            )}
          />
        </div>
      )}

      {offers.length > 0 && (
        <>
          <h3 className="mt-8 text-center text-base font-extrabold text-catcha-chocolate">
            🎟️ คอร์สอาบน้ำ & แพ็กเกจเข้าพัก
          </h3>
          <div className="mt-4">
            <PublicOfferCards
              lineUrl={LINE_URL}
              items={offers.map(
                (o): PublicOfferItem => ({
                  id: o.id,
                  title: o.name,
                  imageUrl: o.imageUrl,
                  chips: offerDetail(o),
                  body: o.description,
                  price: o.price,
                }),
              )}
            />
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
