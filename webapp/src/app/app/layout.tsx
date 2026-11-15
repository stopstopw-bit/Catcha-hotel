import { LocaleProvider } from "@/components/LocaleProvider";
import { LiffProvider } from "@/components/LiffProvider";
import { ConfigProvider } from "@/components/ConfigProvider";
import { CustomerNav } from "@/components/CustomerNav";
import { LiffStuckBanner } from "@/components/LiffStuckBanner";
import { AppFeatureGate } from "@/components/AppFeatureGate";
import { Toaster } from "@/components/Toast";
import { IBM_Plex_Sans_Thai_Looped } from "next/font/google";

/**
 * ฟอนต์หน้าลูกค้า: แบบมีหัวสมัยใหม่ อ่านง่ายกว่าแบบไม่มีหัว (ลูกค้าบอกตัวเล็ก อ่านยาก — เจ้าของขอ 2026-11-15)
 * ขนาด/สีตัวหนังสือที่ปรับให้ใหญ่และเข้มขึ้นอยู่ใน globals.css (.customer-app)
 */
const looped = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-customer",
});

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <ConfigProvider>
        <LiffProvider>
          <div className={`${looped.variable} customer-app bg-catcha-gradient min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))]`}>
            <LiffStuckBanner />
            <div className="mx-auto max-w-lg">
              <AppFeatureGate>{children}</AppFeatureGate>
            </div>
            <CustomerNav />
            <Toaster />
          </div>
        </LiffProvider>
      </ConfigProvider>
    </LocaleProvider>
  );
}
