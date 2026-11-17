"use client";

import { savedPopup } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { FormPosters } from "@/components/FormPosters";
import { resolveFormPosters } from "@/lib/form-posters";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { BTN_PRIMARY, PageHeader } from "@/components/PageHeader";
import { SectionLabel } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";

type CatGender = "male" | "female";
type CatInput = {
  name: string;
  gender?: CatGender;
  breed: string;
  breedOther: string;
  furLength: "" | "short" | "long";
  neutered: "" | "yes" | "no";
  color: string;
  ageValue: string;
  ageUnit: "year" | "month";
  /** น้ำหนัก (กก.) — เก็บเป็นข้อความระหว่างพิมพ์ */
  weightKg: string;
  /** ลูกค้าติ๊ก "ไม่ทราบน้ำหนัก" — ไม่ต้องกรอกช่องน้ำหนัก */
  weightUnknown: boolean;
  /** ลูกค้าติ๊ก "ไม่ทราบอายุ/วันเกิด" — ไม่ต้องกรอกอายุ */
  ageUnknown: boolean;
  birthday: string;
  medical: string;
  seizureHistory: string;
  allergy: string;
  note: string;
};

import { BREED_OPTIONS, OTHER_BREED } from "@/lib/cat-breeds";
import { REFERRAL_OPTIONS } from "@/lib/referral-options";
import { isFeatureOn } from "@/lib/features";
import { referralReward } from "@/lib/referral";
import { StaffNoteTagPicker } from "@/components/StaffNoteTagPicker";
import { STAFF_NOTE_TAGS } from "@/lib/staff-note-tags";
import { customerFetch } from "@/lib/customer-fetch";
import { localizeRegisterForm, resolveRegisterForm } from "@/lib/register-form";
import { useLocale } from "@/components/LocaleProvider";
import { REFERRAL_OPTIONS_EN } from "@/lib/referral-options";
import { NumInput } from "@/components/NumInput";
import { ReviewSheet, reviewDate as thaiDate, type ReviewSection } from "@/components/ReviewSheet";

function emptyCat(): CatInput {
  return {
    name: "",
    breed: "",
    breedOther: "",
    furLength: "",
    neutered: "",
    color: "",
    ageValue: "",
    ageUnit: "year",
    weightKg: "",
    weightUnknown: false,
    ageUnknown: false,
    birthday: "",
    medical: "",
    seizureHistory: "",
    allergy: "",
    note: "",
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const { profile, ready, customer, refreshCustomer, refreshAccount } = useLiff();
  const { config } = useConfig();
  // ปุ่ม TH/EN มุมขวาบน — ใช้ภาษาเดียวกับทั้งแอป (จำไว้ในเครื่อง) + บันทึกเป็นภาษาลูกค้าตอนสมัคร
  const { locale } = useLocale();
  const en = locale === "en";
  const L = (th: string, eng: string) => (en ? eng : th);
  const breeds = config.options?.catBreeds?.length ? config.options.catBreeds : BREED_OPTIONS;
  const referralOn = isFeatureOn(config, "referral");
  // ช่องไหนแสดง/บังคับ/ชื่อช่อง — ร้านตั้งเองในหลังบ้าน › การ์ด › ฟอร์มสมัครสมาชิก
  const rf = localizeRegisterForm(resolveRegisterForm(config.registerForm), locale);
  /** ป้าย (ไม่บังคับ) ต่อท้ายชื่อช่องที่ร้านตั้งว่าไม่บังคับ */
  const optTag = (on: boolean) =>
    on ? null : <span className="font-normal text-brown-faint"> {L("(ไม่บังคับ)", "(optional)")}</span>;
  const referrals = config.options?.referralOptions?.length
    ? config.options.referralOptions
    : REFERRAL_OPTIONS;
  /** ค่าที่บันทึกยังเป็นไทยเสมอ (สถิติ/ตัวกรองหลังบ้านไม่แตก) — แค่โชว์อังกฤษตอน EN */
  const referralName = (v: string) => (en ? REFERRAL_OPTIONS_EN[v] ?? v : v);
  /** "แร็กดอลล์ (Ragdoll)" → "Ragdoll" ตอน EN */
  const breedName = (b: string) => (en ? b.match(/\(([^)]+)\)\s*$/)?.[1] ?? b : b);
  /** แท็กโรคประจำตัว (บันทึกเป็นไทย) → อังกฤษตอน EN */
  const showTags = (v: string) =>
    v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (en ? STAFF_NOTE_TAGS.find((t) => t.label === x)?.labelEn ?? x : x))
      .join(", ");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [referral, setReferral] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [consent, setConsent] = useState(true);
  const [cats, setCats] = useState<CatInput[]>([emptyCat()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  // ติ๊ก "มีโค้ดเพื่อนแนะนำ" แล้วค่อยโชว์ช่องกรอก — มาจากลิงก์ชวนจะติ๊ก + เติมโค้ดให้เอง
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  // ป๊อปอัปสรุปให้ลูกค้าเช็คก่อนบันทึกจริง
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
      setHasReferralCode(true);
      setFromLink(true);
    }
  }, []);

  useEffect(() => {
    if (!customer) return;
    // ชื่อผู้ปกครอง: เว้นว่างให้กรอกเอง (ไม่ดึงชื่อ LINE มาใส่)
    // เบอร์เดิมช่วยเติมให้ ถ้าเคยมีในระบบ
    setPhone((prev) => prev || customer.phone || "");
  }, [customer]);

  const addCat = () => setCats((prev) => [...prev, emptyCat()]);

  const updateCat = (idx: number, patch: Partial<CatInput>) => {
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCat = (idx: number) => {
    if (cats.length <= 1) return;
    setCats((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.lineUserId) return;

    // บังคับเฉพาะช่องที่ร้านตั้งว่าบังคับ (ค่าเริ่มต้น: ทุกช่อง ยกเว้นสี/อายุ/โรคประจำตัว/ชัก/แพ้)
    // n = "" (ตัวเดียว) หรือ " ตัวที่ 2" / " #2"
    const catProblem = (c: CatInput, n: string): string => {
      const cat = `cat${n}`;
      if (!c.name.trim()) return L(`กรอกชื่อน้องแมว${n}ด้วยนะคะ`, `Please enter your ${cat}'s name.`);
      if (rf.gender.required && !c.gender) return L(`เลือกเพศน้องแมว${n}ด้วยนะคะ 🐱`, `Please choose your ${cat}'s sex 🐱`);
      if (rf.breed.required && (!c.breed || (c.breed === OTHER_BREED && !c.breedOther.trim())))
        return L(`เลือกสายพันธุ์น้องแมว${n}ด้วยนะคะ`, `Please choose your ${cat}'s breed.`);
      if (rf.furLength.required && !c.furLength) return L(`เลือกลักษณะขนน้องแมว${n}ด้วยนะคะ`, `Please choose your ${cat}'s coat length.`);
      if (rf.neutered.required && !c.neutered)
        return L(`เลือกว่าน้องแมว${n}ทำหมันแล้วหรือยังด้วยนะคะ`, `Please tell us whether your ${cat} is neutered/spayed.`);
      if (rf.color.required && !c.color.trim()) return L(`กรอกสี/ลักษณะเด่นน้องแมว${n}ด้วยนะคะ`, `Please enter your ${cat}'s colour/markings.`);
      if (rf.age.required && !c.ageUnknown && !(Number(c.ageValue) > 0))
        return L(`กรอกอายุน้องแมว${n} หรือติ๊ก "ไม่ทราบ" ด้วยนะคะ`, `Please enter your ${cat}'s age, or tick "Unknown".`);
      if (rf.weight.required && !c.weightUnknown && !(Number(c.weightKg) > 0))
        return L(`กรอกน้ำหนักน้องแมว${n} หรือติ๊ก "ไม่ทราบ" ด้วยนะคะ`, `Please enter your ${cat}'s weight, or tick "Unknown".`);
      if (rf.medical.required && !c.medical.trim() && !c.note.trim())
        return L(`เลือกโรคประจำตัวน้องแมว${n} (ไม่มีก็เลือก/พิมพ์ว่า "ไม่มี") ด้วยนะคะ`, `Please fill in your ${cat}'s health conditions (type "None" if none).`);
      if (rf.seizure.required && !c.seizureHistory.trim())
        return L(`กรอกประวัติการชัก/ช็อคน้องแมว${n} (ไม่มีพิมพ์ว่า "ไม่มี") ด้วยนะคะ`, `Please fill in your ${cat}'s seizure history (type "None" if none).`);
      if (rf.allergy.required && !c.allergy.trim())
        return L(`กรอกประวัติการแพ้น้องแมว${n} (ไม่มีพิมพ์ว่า "ไม่มี") ด้วยนะคะ`, `Please fill in your ${cat}'s allergies (type "None" if none).`);
      return "";
    };
    for (let i = 0; i < cats.length; i++) {
      const problem = catProblem(cats[i], cats.length > 1 ? (en ? ` #${i + 1}` : ` ตัวที่ ${i + 1}`) : "");
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (rf.email.required && !email.trim()) {
      setError(L("กรอกอีเมลด้วยนะคะ", "Please enter your email."));
      return;
    }
    if (rf.ownerBirthday.required && !birthday) {
      setError(L("เลือกวันเกิดผู้ปกครองด้วยนะคะ", "Please choose your birthday."));
      return;
    }
    if (rf.postalCode.required ? !/^\d{5}$/.test(postalCode) : postalCode && !/^\d{5}$/.test(postalCode)) {
      setError(L("กรอกรหัสไปรษณีย์ 5 หลักด้วยนะคะ", "Please enter a 5-digit postal code."));
      return;
    }
    if (rf.referral.enabled && rf.referral.required && !referral) {
      setError(L("เลือกช่องทางที่รู้จักเราด้วยนะคะ", "Please tell us how you heard about us."));
      return;
    }
    if (referralOn && hasReferralCode && !referralCode.trim()) {
      setError(L("กรอกโค้ดเพื่อนแนะนำ หรือเอาติ๊กออกถ้าไม่มีโค้ดนะคะ", "Please enter the referral code, or untick the box if you don't have one."));
      return;
    }

    // ผ่านครบ → โชว์สรุปให้เช็คก่อน ยังไม่บันทึก
    setError("");
    setReviewing(true);
  };

  /** สรุปทุกช่องที่ร้านเปิดไว้ — ให้ลูกค้าเห็นภาพเดียวกับที่ร้านจะได้ */
  const reviewSections = (): ReviewSection[] => {
    const owner: ReviewSection = {
      title: L("ข้อมูลผู้ปกครอง", "Your details"),
      icon: "user",
      rows: [
        { label: rf.ownerName.label, value: name },
        { label: rf.phone.label, value: phone },
        ...(rf.email.enabled ? [{ label: rf.email.label, value: email }] : []),
        ...(rf.ownerBirthday.enabled ? [{ label: rf.ownerBirthday.label, value: thaiDate(birthday, locale) }] : []),
        ...(rf.postalCode.enabled ? [{ label: rf.postalCode.label, value: postalCode }] : []),
      ],
    };
    const catSections: ReviewSection[] = cats
      .filter((c) => c.name.trim())
      .map((c, i, arr) => ({
        title: arr.length > 1
          ? `${L("น้องแมวตัวที่", "Cat #")}${en ? "" : " "}${i + 1} · ${c.name.trim()}`
          : `${L("น้องแมว", "Cat")} · ${c.name.trim()}`,
        icon: "paw",
        rows: [
          ...(rf.gender.enabled
            ? [{ label: rf.gender.label, value: c.gender === "male" ? L("♂ ผู้", "♂ Male") : c.gender === "female" ? L("♀ เมีย", "♀ Female") : "" }]
            : []),
          ...(rf.breed.enabled
            ? [{ label: rf.breed.label, value: c.breed === OTHER_BREED ? c.breedOther : c.breed }]
            : []),
          ...(rf.furLength.enabled
            ? [{ label: rf.furLength.label, value: c.furLength === "long" ? L("ขนยาว", "Long hair") : c.furLength === "short" ? L("ขนสั้น", "Short hair") : "" }]
            : []),
          ...(rf.neutered.enabled
            ? [{ label: rf.neutered.label, value: c.neutered === "yes" ? L("ทำหมันแล้ว", "Yes") : c.neutered === "no" ? L("ยังไม่ทำหมัน", "Not yet") : "" }]
            : []),
          ...(rf.color.enabled ? [{ label: rf.color.label, value: c.color }] : []),
          ...(rf.age.enabled
            ? [
                {
                  label: rf.age.label,
                  value: c.ageUnknown
                    ? L("ไม่ทราบ", "Unknown")
                    : [
                        c.ageValue
                          ? `${c.ageValue} ${c.ageUnit === "month" ? L("เดือน", "months") : L("ปี", "years")}`
                          : "",
                        c.birthday ? `${L("เกิด", "Born")} ${thaiDate(c.birthday, locale)}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                },
              ]
            : []),
          ...(rf.weight.enabled
            ? [{ label: rf.weight.label, value: c.weightUnknown ? L("ไม่ทราบ", "Unknown") : c.weightKg ? `${c.weightKg} ${L("กก.", "kg")}` : "" }]
            : []),
          ...(rf.medical.enabled
            ? [{ label: rf.medical.label, value: [c.medical, c.note].map((x) => showTags(x)).filter(Boolean).join("\n") }]
            : []),
          ...(rf.seizure.enabled ? [{ label: rf.seizure.label, value: c.seizureHistory }] : []),
          ...(rf.allergy.enabled ? [{ label: rf.allergy.label, value: c.allergy }] : []),
        ],
      }));
    const other: ReviewSection = {
      title: L("อื่น ๆ", "Other"),
      icon: "sparkle",
      rows: [
        ...(rf.referral.enabled ? [{ label: rf.referral.label, value: referralName(referral) }] : []),
        ...(referralOn && hasReferralCode ? [{ label: L("โค้ดเพื่อนแนะนำ", "Referral code"), value: referralCode }] : []),
        { label: L("รับข่าวสาร/โปรโมชั่น", "News & promotions"), value: consent ? L("ยินยอม", "Yes, send me") : L("ไม่ยินยอม", "No thanks") },
      ],
    };
    return [owner, ...catSections, other];
  };

  const save = async () => {
    if (!profile?.lineUserId) return;
    setSaving(true);
    setError("");

    try {
      const res = await customerFetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.lineUserId,
          name,
          phone,
          email,
          birthday,
          referralSource: referral,
          referralCode: (referralOn && hasReferralCode && referralCode.trim()) || undefined,
          postalCode: postalCode || undefined,
          marketingConsent: consent,
          language: locale,
          cats: cats
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name,
              gender: c.gender,
              breed:
                (c.breed === OTHER_BREED ? c.breedOther.trim() : c.breed) ||
                undefined,
              ageValue: !c.ageUnknown && c.ageValue ? Number(c.ageValue) : undefined,
              ageUnit: !c.ageUnknown && c.ageValue ? c.ageUnit : undefined,
              weightKg: !c.weightUnknown && c.weightKg ? Number(c.weightKg) : undefined,
              birthday: (!c.ageUnknown && c.birthday) || undefined,
              medical: c.medical || undefined,
              seizureHistory: c.seizureHistory.trim() || undefined,
              allergy: c.allergy.trim() || undefined,
              furLength: c.furLength || undefined,
              neutered: c.neutered ? c.neutered === "yes" : undefined,
              color: c.color || undefined,
              staffNote: c.note || undefined,
            })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // ข้อความจากเซิร์ฟเวอร์เป็นไทย — ฟอร์ม EN แปลเคสที่เจอบ่อย
        if (en) {
          setError(
            /โค้ดเพื่อนแนะนำ/.test(String(data.error || ""))
              ? `Referral code "${referralCode}" not found — check the spelling, or untick the box if you don't have one.`
              : "Sign-up failed — please try again."
          );
        } else setError(data.error || "ลงทะเบียนไม่สำเร็จ — ลองใหม่อีกครั้งนะคะ");
        return;
      }

      // ข้อมูลลูกค้ากับแต้มไม่ขึ้นต่อกัน — โหลดพร้อมกัน
      await Promise.all([refreshCustomer(), refreshAccount()]);
      const petNames = cats.map((c) => c.name.trim()).filter(Boolean);
      savedPopup(
        L("สมัครสมาชิกสำเร็จ 🎉", "You're signed up 🎉"),
        en
          ? [petNames.length ? `${petNames.join(", ")} ${petNames.length > 1 ? "are" : "is"} registered.` : "", "You can book and see your cat's details on the home page."]
          : [petNames.length ? `ลงทะเบียนน้อง ${petNames.join(", ")} เรียบร้อยแล้วค่ะ` : "", "จองคิวและดูข้อมูลน้องได้ที่หน้าแรกเลยค่ะ"],
        { afterNav: true }
      );
      setReviewing(false);
      router.replace("/app");
    } catch {
      setError(
        L(
          "เชื่อมต่อไม่สำเร็จ — เช็คสัญญาณอินเทอร์เน็ตแล้วลองกดบันทึกอีกครั้งนะคะ",
          "Couldn't connect — check your internet and tap save again."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <LoadingScreen message={L("กำลังเชื่อมต่อ LINE…", "Connecting to LINE…")} />;
  }

  const fieldClass =
    "min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm";
  const subFieldClass =
    "min-h-[44px] w-full rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm";

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Sign up"
        title={L("สมัครสมาชิก เพื่อรับสิทธิพิเศษ", "Become a member")}
        subtitle={L(
          "กรอกข้อมูลครั้งเดียว — ใช้ยืนยันนัด แต้มสะสม และโปรโมชั่น",
          "Fill this in once — used for bookings, points and promotions"
        )}
        back="/app"
        backLabel={L("กลับหน้าแรก", "Back to home")}
      />

      {fromLink && referralOn && (
        <div className="mb-4 flex items-start gap-2 rounded-catcha border border-honey/50 bg-honey/20 px-4 py-3 text-xs font-extrabold text-catcha-chocolate">
          <Icon name="gift" size={16} className="mt-px" />
          <span>
            {en ? (
              <>Invited by a friend — once you sign up, you and your friend both get a <span className="text-latte-deep">{referralReward(config).amount}฿</span> coupon!</>
            ) : (
              <>สมัครผ่านเพื่อนแนะนำ — สมัครเสร็จรับคูปองส่วนลด <span className="text-latte-deep">{referralReward(config).amount}฿</span> ทั้งคุณและเพื่อนทันที!</>
            )}
          </span>
        </div>
      )}

      {/* รูปที่ร้านตั้งไว้ในหลังบ้าน (การ์ด & ฟอร์ม › ฟอร์มสมัครสมาชิก) */}
      <FormPosters images={resolveFormPosters(config.formPosters, "register")} alt={L("ข้อมูลจากร้าน", "Shop information")} className="mb-5" />

      <form onSubmit={submit} className="space-y-6">
        {/* ── ข้อมูลผู้ปกครอง ── */}
        <section>
        <SectionLabel>{L("Owner · ข้อมูลผู้ปกครอง", "Owner")}</SectionLabel>
        <div className="space-y-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">
            {rf.ownerName.label}{" "}
            <span className="font-normal text-brown-faint">
              {L("(ชื่อเล่นหรือชื่อจริงก็ได้นะคะ)", "(nickname or full name)")}
            </span>
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={L("เช่น คุณมาย", "e.g. May")}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">{rf.phone.label}</span>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            className={fieldClass}
          />
        </label>

        {/* จอมือถือ: อีเมล/วันเกิดคนละแถว — วางคู่กันแล้วช่องวัน/เดือน/ปีแคบจนอ่านไม่ออก */}
        {(rf.email.enabled || rf.ownerBirthday.enabled) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rf.email.enabled && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brown">{rf.email.label}{optTag(rf.email.required)}</span>
            <input
              required={rf.email.required}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className={fieldClass}
            />
          </label>
          )}
          {rf.ownerBirthday.enabled && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brown">
              {rf.ownerBirthday.label}{optTag(rf.ownerBirthday.required)}
            </span>
            <BirthdayPicker
              required={rf.ownerBirthday.required}
              value={birthday}
              onChange={setBirthday}
              yearsBack={90}
              locale={locale}
            />
          </label>
          )}
        </div>
        )}

        {rf.postalCode.enabled && (
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">
            {rf.postalCode.label}{optTag(rf.postalCode.required)}
          </span>
          <input
            required={rf.postalCode.required}
            pattern="[0-9]{5}"
            value={postalCode}
            onChange={(e) =>
              setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
            }
            inputMode="numeric"
            placeholder={L("เช่น 10540", "e.g. 10540")}
            className={fieldClass}
          />
        </label>
        )}
        </div>
        </section>

        {/* ── น้องแมว ── */}
        <section>
          <SectionLabel>{L("My cats · น้องแมว", "My cats")}</SectionLabel>
          <ul className="space-y-3">
            {cats.map((cat, idx) => (
              <li
                key={idx}
                className="space-y-2.5 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm"
              >
                {cats.length > 1 && (
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-catcha-chocolate">
                    <Icon name="paw" size={14} />
                    {L("ตัวที่", "Cat #")}{en ? "" : " "}{idx + 1}
                  </p>
                )}
                <input
                  required
                  value={cat.name}
                  onChange={(e) => updateCat(idx, { name: e.target.value })}
                  placeholder={rf.catName.label}
                  className={subFieldClass}
                />

                {rf.gender.enabled && (
                <div>
                <span className="mb-1 block text-[11px] font-bold text-brown-soft">
                  {rf.gender.label}{optTag(rf.gender.required)}
                </span>
                <div className="flex gap-1 rounded-full bg-paper p-1">
                  {(
                    [
                      ["male", L("♂ ผู้", "♂ Male")],
                      ["female", L("♀ เมีย", "♀ Female")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        updateCat(idx, {
                          gender: cat.gender === value ? undefined : value,
                        })
                      }
                      aria-pressed={cat.gender === value}
                      className={`min-h-[40px] flex-1 rounded-full text-sm font-bold transition ${
                        cat.gender === value
                          ? "bg-card text-catcha-chocolate shadow-catcha-sm"
                          : "text-brown-soft"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                </div>
                )}

                {rf.breed.enabled && (
                <div>
                <span className="mb-1 block text-[11px] font-bold text-brown-soft">
                  {rf.breed.label}{optTag(rf.breed.required)}
                </span>
                <select
                  required={rf.breed.required}
                  value={cat.breed}
                  onChange={(e) => updateCat(idx, { breed: e.target.value })}
                  className={`${subFieldClass} ${
                    cat.breed ? "text-brown" : "text-brown-faint"
                  }`}
                >
                  <option value="">{L("เลือกสายพันธุ์…", "Choose a breed…")}</option>
                  {breeds.map((b) => (
                    <option key={b} value={b} className="text-brown">
                      {breedName(b)}
                    </option>
                  ))}
                  <option value={OTHER_BREED} className="text-brown">
                    {breedName(OTHER_BREED)}
                  </option>
                </select>
                {cat.breed === OTHER_BREED && (
                  <input
                    required
                    value={cat.breedOther}
                    onChange={(e) => updateCat(idx, { breedOther: e.target.value })}
                    placeholder={L("ระบุสายพันธุ์", "Type the breed")}
                    className={`${subFieldClass} mt-2`}
                  />
                )}
                </div>
                )}
                {rf.furLength.enabled && (
                <div>
                  <span className="mb-1 block text-[11px] font-bold text-brown-soft">
                    {rf.furLength.label}{optTag(rf.furLength.required)}
                  </span>
                  <div className="flex gap-1 rounded-full bg-paper p-1">
                    {(
                      [
                        ["short", L("ขนสั้น", "Short hair")],
                        ["long", L("ขนยาว", "Long hair")],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateCat(idx, { furLength: value })}
                        aria-pressed={cat.furLength === value}
                        className={`min-h-[40px] flex-1 rounded-full text-sm font-bold transition ${
                          cat.furLength === value
                            ? "bg-card text-catcha-chocolate shadow-catcha-sm"
                            : "text-brown-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                )}
                {rf.neutered.enabled && (
                <div>
                  <span className="mb-1 block text-[11px] font-bold text-brown-soft">
                    {rf.neutered.label}{optTag(rf.neutered.required)}
                  </span>
                  <div className="flex gap-1 rounded-full bg-paper p-1">
                    {(
                      [
                        ["yes", L("ทำหมันแล้ว", "Yes")],
                        ["no", L("ยังไม่ทำ", "Not yet")],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateCat(idx, { neutered: value })}
                        aria-pressed={cat.neutered === value}
                        className={`min-h-[40px] flex-1 rounded-full text-sm font-bold transition ${
                          cat.neutered === value
                            ? "bg-card text-catcha-chocolate shadow-catcha-sm"
                            : "text-brown-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                )}
                {rf.color.enabled && (
                <div className="text-[11px] font-bold text-brown-soft">
                  {rf.color.label}{optTag(rf.color.required)}
                <input
                  value={cat.color}
                  onChange={(e) => updateCat(idx, { color: e.target.value })}
                  placeholder={L("เช่น สีขาวสลับดำ", "e.g. black and white")}
                  className={`${subFieldClass} mt-0.5 font-normal text-brown`}
                />
                </div>
                )}
                {rf.age.enabled && (
                <>
                <div className="text-[11px] font-bold text-brown-soft">
                  {rf.age.label}{optTag(rf.age.required)}
                  <div className="mt-0.5 flex items-center gap-2">
                    <NumInput
                      disabled={cat.ageUnknown}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={cat.ageUnknown ? "" : cat.ageValue}
                      onChange={(e) => updateCat(idx, { ageValue: e.target.value })}
                      placeholder={cat.ageUnknown ? L("ไม่ทราบอายุ", "Age unknown") : L("อายุ", "Age")}
                      className={`${subFieldClass} min-w-0 flex-1 disabled:opacity-50`}
                    />
                    {!cat.ageUnknown && (
                      <select
                        value={cat.ageUnit}
                        onChange={(e) =>
                          updateCat(idx, {
                            ageUnit: e.target.value as "year" | "month",
                          })
                        }
                        className="min-h-[44px] w-20 shrink-0 rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm font-normal text-brown"
                      >
                        <option value="year">{L("ปี", "years")}</option>
                        <option value="month">{L("เดือน", "months")}</option>
                      </select>
                    )}
                    <label className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 text-xs font-bold text-brown">
                      <input
                        type="checkbox"
                        checked={cat.ageUnknown}
                        onChange={(e) =>
                          updateCat(idx, {
                            ageUnknown: e.target.checked,
                            ageValue: "",
                            birthday: "",
                          })
                        }
                        className="h-5 w-5 accent-latte-deep"
                      />
                      {L("ไม่ทราบ", "Unknown")}
                    </label>
                  </div>
                </div>
                {!cat.ageUnknown && (
                  <div className="text-[11px] font-bold text-brown-soft">
                    {L("วันเกิดน้องแมว", "Cat's birthday")}{" "}
                    <span className="font-normal text-brown-faint">
                      {L("(ถ้าทราบ · ไม่บังคับ)", "(if known · optional)")}
                    </span>
                    <div className="mt-0.5">
                      <BirthdayPicker
                        value={cat.birthday}
                        onChange={(iso) => updateCat(idx, { birthday: iso })}
                        yearsBack={25}
                        allowUnknown
                        locale={locale}
                      />
                    </div>
                  </div>
                )}
                </>
                )}
                {rf.weight.enabled && (
                <div className="text-[11px] font-bold text-brown-soft">
                  {rf.weight.label}{optTag(rf.weight.required)}
                  <div className="mt-0.5 flex items-center gap-2">
                    <NumInput
                      required={rf.weight.required && !cat.weightUnknown}
                      disabled={cat.weightUnknown}
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={cat.weightUnknown ? "" : cat.weightKg}
                      onChange={(e) => updateCat(idx, { weightKg: e.target.value })}
                      placeholder={cat.weightUnknown ? L("ไม่ทราบน้ำหนัก", "Weight unknown") : L("เช่น 4.5", "e.g. 4.5")}
                      className={`${subFieldClass} min-w-0 flex-1 disabled:opacity-50`}
                    />
                    <label className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 text-xs font-bold text-brown">
                      <input
                        type="checkbox"
                        checked={cat.weightUnknown}
                        onChange={(e) =>
                          updateCat(idx, { weightUnknown: e.target.checked, weightKg: "" })
                        }
                        className="h-5 w-5 accent-latte-deep"
                      />
                      {L("ไม่ทราบ", "Unknown")}
                    </label>
                  </div>
                </div>
                )}

                {rf.medical.enabled && (
                <StaffNoteTagPicker
                  label={rf.medical.required ? `${rf.medical.label} *` : rf.medical.label}
                  medicalValue={cat.medical}
                  noteValue={cat.note}
                  onChange={(medical, note) => updateCat(idx, { medical, note })}
                  locale={locale}
                />
                )}
                {rf.seizure.enabled && (
                <label className="block text-[11px] font-bold text-brown-soft">
                  {rf.seizure.label}{" "}
                  <span className="font-normal text-brown-faint">
                    {rf.seizure.required ? L("(ไม่มีพิมพ์ว่า ไม่มี)", '(type "None" if none)') : L("(ไม่มีเว้นว่างได้)", "(leave blank if none)")}
                  </span>
                  <input
                    value={cat.seizureHistory}
                    onChange={(e) => updateCat(idx, { seizureHistory: e.target.value })}
                    placeholder={L("เช่น ไม่เคย · หรือ เคยชักตอนตกใจ", "e.g. Never · or had a seizure when frightened")}
                    className={`${subFieldClass} mt-0.5 font-normal text-brown`}
                  />
                </label>
                )}
                {rf.allergy.enabled && (
                <label className="block text-[11px] font-bold text-brown-soft">
                  {rf.allergy.label}{" "}
                  <span className="font-normal text-brown-faint">
                    {rf.allergy.required ? L("(ไม่มีพิมพ์ว่า ไม่มี)", '(type "None" if none)') : L("(ไม่มีเว้นว่างได้)", "(leave blank if none)")}
                  </span>
                  <input
                    value={cat.allergy}
                    onChange={(e) => updateCat(idx, { allergy: e.target.value })}
                    placeholder={L("เช่น ไม่มี · หรือ แพ้ไก่ แพ้แชมพูบางยี่ห้อ", "e.g. None · or chicken, some shampoos")}
                    className={`${subFieldClass} mt-0.5 font-normal text-brown`}
                  />
                </label>
                )}

                {cats.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCat(idx)}
                    className="-ml-1 flex min-h-[44px] items-center gap-1.5 px-1 text-xs font-bold text-brown-soft"
                  >
                    <Icon name="trash" size={15} />
                    {L("ลบน้องแมวตัวนี้", "Remove this cat")}
                  </button>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addCat}
            className="mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-catcha border-2 border-honey-deep bg-honey/45 px-4 text-left text-catcha-chocolate shadow-catcha-sm transition active:scale-[.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-catcha-chocolate text-card">
              <Icon name="plus" size={20} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">{L("เพิ่มน้องแมวอีกตัว", "Add another cat")}</span>
              <span className="block text-[11px] text-catcha-chocolate/70">{L("มีหลายตัว เพิ่มได้ทุกตัวเลยค่ะ", "Have more than one? Add them all here.")}</span>
            </span>
            <Icon name="paw" size={22} className="text-catcha-chocolate/60" />
          </button>
        </section>

        {/* ── รู้จักเราจากทางไหน ── */}
        {rf.referral.enabled && (
        <section>
          <SectionLabel>
            {en ? rf.referral.label : <>Referral · {rf.referral.label}</>}{" "}
            {rf.referral.required && <span className="text-red-600">*</span>}
          </SectionLabel>
          <div className="flex flex-wrap gap-2 rounded-catcha border border-catcha-line bg-card p-3 shadow-catcha-sm">
            {referrals.map((opt) => (
              <button
                key={opt}
                type="button"
                aria-pressed={referral === opt}
                onClick={() => setReferral((prev) => (prev === opt ? "" : opt))}
                className={`min-h-[44px] rounded-full px-4 text-xs font-bold transition ${
                  referral === opt
                    ? "bg-latte/40 text-catcha-chocolate ring-1 ring-latte-deep"
                    : "bg-paper text-brown-soft"
                }`}
              >
                {referralName(opt)}
              </button>
            ))}
          </div>
        </section>
        )}

        {/* ── โค้ดเพื่อนแนะนำ (ไม่บังคับ) · ร้านปิด "ชวนเพื่อนรับคูปอง" = ไม่ถาม ── */}
        {referralOn && (
        <div className="rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={hasReferralCode}
              onChange={(e) => setHasReferralCode(e.target.checked)}
              className="h-5 w-5 flex-none accent-[#4A7348]"
            />
            <span className="text-xs font-bold text-brown">
              {L("มีโค้ดเพื่อนแนะนำ", "I have a referral code")}
              <span className="block text-[11px] font-normal text-brown-faint">
                {en
                  ? `Enter the code — you and your friend both get a ${referralReward(config).amount}฿ coupon`
                  : `กรอกโค้ด รับคูปอง ${referralReward(config).amount}฿ ทั้งคุณและเพื่อน`}
              </span>
            </span>
          </label>
          {hasReferralCode && (
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
              placeholder={L("เช่น CAT1A2B3C", "e.g. CAT1A2B3C")}
              autoCapitalize="characters"
              autoComplete="off"
              className={`mt-3 ${fieldClass} font-extrabold tracking-wider`}
            />
          )}
        </div>
        )}

        {/* ── ยินยอมรับข่าวสาร ── */}
        <label className="flex cursor-pointer items-start gap-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-[#4A7348]"
          />
          <span className="text-xs text-brown">
            {L("ยินยอมให้ส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษ", "Send me news, promotions and member offers")}
            <span className="mt-0.5 block text-[11px] text-brown-faint">
              {L(
                "ถ้าไม่ยินยอม จะไม่ได้รับโปร/ข่าวสาร แต่ยังได้รับการยืนยันนัดและแจ้งชำระเงินตามปกติ",
                "If you untick this, you won't get promotions, but you'll still get booking and payment messages."
              )}
            </span>
          </span>
        </label>

        {error && (
          <p className="rounded-catcha-sm bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className={BTN_PRIMARY}
        >
          {saving ? L("กำลังบันทึก…", "Saving…") : L("บันทึกข้อมูล", "Save")}
        </button>
      </form>
      <ReviewSheet
        open={reviewing}
        sections={reviewing ? reviewSections() : []}
        saving={saving}
        error={error}
        locale={locale}
        confirmLabel={L("ยืนยัน สมัครสมาชิก", "Confirm sign-up")}
        onEdit={() => {
          setReviewing(false);
          setError("");
        }}
        onConfirm={save}
      />
    </div>
  );
}
