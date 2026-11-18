import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import Image from "next/image";
import { LangLink, RememberLang } from "@/components/LangLink";
import { BUSINESS } from "@/lib/business";
import { getSiteConfig } from "@/lib/config-store";
import { resolveGroomPrograms } from "@/lib/grooming-prices";
import SiteFooter from "@/components/SiteFooter";
import { getAppUrl } from "@/lib/app-url";
import { posterFor, roomEnPoster } from "@/lib/en-posters";
import { localBusinessNode, breadcrumbNode, faqNode, SHOP_ADDRESS } from "@/lib/seo-schema";

/**
 * English page — for expats and travellers (Bang Na / Mega Bangna / Suvarnabhumi) who search
 * "cat hotel bangkok", "cat boarding near suvarnabhumi" or ask AI assistants in English.
 */

export const revalidate = 300;

const SITE_URL = getAppUrl();
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";
const PHONE_INTL = "+66 80 549 8969";
const PATH = "/en";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Cat Hotel near Bang Na & Suvarnabhumi Airport | CatCha Hotel Bangkok",
  description:
    "CatCha Hotel is a cats-only boarding hotel and grooming spa in Bang Phli, Samut Prakan, 10 minutes from Mega Bangna and close to Suvarnabhumi Airport. Private air-conditioned rooms, CCTV, daily photo updates on LINE. From 350 THB/night.",
  keywords: [
    "cat hotel bangkok",
    "cat hotel bangna",
    "cat boarding bangkok",
    "cat boarding near suvarnabhumi",
    "cat hotel mega bangna",
    "cat grooming bangna",
    "cat sitter bangkok",
  ],
  alternates: { canonical: PATH, languages: { th: "/", en: PATH } },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}${PATH}`,
    siteName: "CatCha Hotel",
    title: "CatCha Hotel – Cat Hotel & Grooming near Bang Na, Bangkok",
    description: "Private air-conditioned cat rooms, CCTV and daily LINE updates. From 350 THB/night.",
    images: [{ url: "/catalog/en/room-cozy-duo.jpg", width: 1402, height: 1122, alt: "CatCha Hotel cat room" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "Where is CatCha Hotel?",
    a: `${SHOP_ADDRESS.full} (Bang Phli, Samut Prakan). About 10 minutes from Mega Bangna / IKEA Bangna and close to Suvarnabhumi Airport. Free parking in front of the shop.`,
  },
  {
    q: "How much does cat boarding cost?",
    a: "Rooms start at 350 THB per night. Larger rooms and connecting rooms for 2–4 cats cost 450–750 THB per night. All rooms are air-conditioned. Free litter for stays of 3 nights or more.",
  },
  {
    q: "Can I see my cat while I'm away?",
    a: "Yes. Rooms have CCTV, and our staff send photos and a short report on LINE every morning and evening.",
  },
  {
    q: "What do I need to bring?",
    a: "Your cat's usual food, any medication, and the vaccination book. Cats should be vaccinated and have a flea/tick spot-on treatment before check-in.",
  },
  {
    q: "Do you offer grooming?",
    a: "We offer private cat baths and blow-dry (from 400 THB), degreasing baths, antifungal Malaseb baths and the Catcha Premium coat treatment. We do not offer haircuts/shaving.",
  },
  {
    q: "How do I book?",
    a: `Message us on LINE @catchahotel or call ${PHONE_INTL}. Open daily 09:00–19:00 (check-in 09:00–18:00).`,
  },
];

function EnPoster({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
      <Image src={src} alt={alt} width={800} height={900} sizes="(max-width: 640px) 100vw, 50vw" className="h-auto w-full" />
    </a>
  );
}

export default async function EnglishPage() {
  if (!isMarketingSite()) redirect("/app");
  const config = await getSiteConfig();
  const rooms = config.rooms;
  const programs = resolveGroomPrograms(config.groomPricePrograms);
  const bathFrom = Math.min(...programs.flatMap((p) => p.breeds.flatMap((b) => Object.values(b.prices))), 400);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [localBusinessNode(), breadcrumbNode("Cat hotel (English)", PATH), faqNode(FAQS)],
  };

  return (
    <main lang="en" className="mx-auto max-w-3xl px-5 pb-16 pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex justify-end">
        <RememberLang lang="en" />
        <LangLink
          href="/"
          lang="th"
          className="rounded-full border border-catcha-line bg-card px-3 py-1.5 text-xs font-extrabold text-catcha-chocolate shadow-catcha-sm"
        >
          🇹🇭 ภาษาไทย
        </LangLink>
      </div>

      <header className="mt-2 text-center sm:text-left">
        <Image
          src="/logo.jpg"
          alt="CatCha Hotel logo"
          width={80}
          height={80}
          priority
          className="mx-auto rounded-full border-4 border-honey/50 shadow-catcha sm:mx-0"
        />
        <h1 className="mt-4 text-2xl font-extrabold leading-snug text-catcha-chocolate md:text-3xl">
          CatCha Hotel – Cat Hotel &amp; Grooming
          <span className="block text-lg text-latte-deep md:text-xl">
            Near Bang Na, Mega Bangna &amp; Suvarnabhumi Airport
          </span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brown-soft">
          A cats-only boarding hotel in Bang Phli, Samut Prakan (south-east Bangkok). Every cat gets a private
          air-conditioned room, daily cleaning and two play sessions a day. Rooms have CCTV, and we send photos
          and a short report on LINE every morning and evening, so you can relax while you travel.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a href={LINE_URL} className="rounded-catcha-sm bg-[#06C755] px-6 py-3 text-center text-sm font-extrabold text-white shadow-catcha-sm">
            💬 Book on LINE @catchahotel
          </a>
          <a href="#rooms" className="rounded-catcha-sm border-2 border-latte-deep bg-card px-6 py-3 text-center text-sm font-extrabold text-latte-deep shadow-catcha-sm">
            🏠 See rooms &amp; prices
          </a>
        </div>
      </header>

      <h2 id="rooms" className="mt-10 scroll-mt-4 text-lg font-extrabold text-catcha-chocolate">Rooms &amp; prices (per night)</h2>
      <p className="mt-1 text-xs text-brown-soft">Tap a picture to enlarge.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rooms.map((r) => {
          const src = posterFor(r.image, "en", roomEnPoster(r));
          return (
            <a
              key={r.id}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm"
            >
              <Image src={src} alt={`CatCha Hotel ${r.name} cat room`} width={800} height={900} sizes="(max-width: 640px) 100vw, 50vw" className="h-auto w-full" />
              <div className="p-3 text-center">
                <p className="text-sm font-extrabold text-catcha-chocolate">{r.name}</p>
                <p className="text-xs text-brown-soft">{r.cats.en}</p>
                <p className="text-xs font-bold text-latte-deep">{r.price.toLocaleString()} THB / night</p>
              </div>
            </a>
          );
        })}
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">How to book &amp; service hours</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        Open daily 09:00–19:00. Check-in 09:00–18:00, check-out 09:00–19:00.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EnPoster src="/catalog/en/booking-steps.jpg" alt="How to book a room at CatCha Hotel in 4 easy steps: check availability, send cat details, pay a deposit, receive booking confirmation on LINE" />
        <EnPoster src="/catalog/en/hours.jpg" alt="CatCha Hotel service hours: open daily 09:00–19:00, check-in 09:00–18:00, check-out 09:00–19:00" />
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">Before your cat&apos;s stay</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        Cats need up-to-date vaccinations and a flea/tick spot-on treatment within 1 month before check-in.
        Please read our check-in conditions and what to bring.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EnPoster src="/catalog/en/prepare-check-in.jpg" alt="What to prepare for check-in at CatCha Hotel: vaccination record, flea and tick prevention, food, familiar belongings, carrier" />
        <EnPoster src="/catalog/en/before-check-in.jpg" alt="Before check-in: up-to-date vaccinations, flea and tick treatment within 1 month, required information" />
        <EnPoster src="/catalog/en/stay-conditions.jpg" alt="Important guidelines for your cat's stay: cat-only enclosed area, healthy cats, vaccinations, daily photo updates" />
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">Cat grooming</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        Private bath and blow-dry from {bathFrom} THB, one household at a time. Nail trim and ear cleaning
        included. Degreasing bath, antifungal Malaseb bath and Catcha Premium coat care are also available.
        No haircuts/shaving. A 200 THB deposit holds your booking.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EnPoster src="/catalog/en/grooming-menu.jpg" alt="Catcha Grooming menu: bath and blow-dry, degreasing bath, Catcha Premium and anti-fungal Malaseb programs, prices by cat type and size" />
        <EnPoster src="/catalog/en/before-grooming.jpg" alt="Important information before grooming: withhold food 2–3 hours, tell us about medical conditions, bring your cat in a carrier" />
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">Members &amp; rewards</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        Sign up as a member on LINE, collect points every visit and redeem them for treats or discounts.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EnPoster src="/catalog/en/new-member.jpg" alt="New member: get 5% off when you sign up and leave a review on Google Maps" />
        <EnPoster src="/catalog/en/rewards.jpg" alt="Stay more, earn more: collect points and redeem rewards for grooming or cat hotel services" />
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">Pick-up &amp; delivery</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        We can pick up your cat and bring them home in a private car. The fee depends on the distance.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EnPoster src="/catalog/en/transport.jpg" alt="CatCha Hotel cat pick-up and delivery service, priced by distance" />
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">Location</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        {SHOP_ADDRESS.full}. Open daily 09:00–19:00. Pick-up and drop-off service available (priced by distance).
      </p>
      <iframe
        title="CatCha Hotel map"
        src="https://www.google.com/maps?q=13.6290175,100.654973&z=16&hl=en&output=embed"
        className="mt-3 block h-64 w-full rounded-catcha border-0 md:h-80"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="mt-3 text-center">
        <a href={BUSINESS.maps} target="_blank" rel="noopener noreferrer" className="inline-block rounded-catcha-sm bg-honey/40 px-6 py-3 text-sm font-extrabold text-catcha-chocolate">
          🗺️ Open in Google Maps
        </a>
      </p>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">FAQ</h2>
      <div className="mt-3 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-catcha">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">Book a stay</h2>
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={LINE_URL} className="rounded-catcha-sm bg-[#06C755] px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm">
            💬 LINE @catchahotel
          </a>
          <a href="tel:+66805498969" className="rounded-catcha-sm bg-latte-deep px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm">
            📞 {PHONE_INTL}
          </a>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
