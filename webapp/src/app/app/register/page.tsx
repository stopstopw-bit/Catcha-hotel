"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
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
import { customerFetch } from "@/lib/customer-fetch";
import { resolveRegisterForm } from "@/lib/register-form";

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
  const breeds = config.options?.catBreeds?.length ? config.options.catBreeds : BREED_OPTIONS;
  const referralOn = isFeatureOn(config, "referral");
  // ช่องไหนแสดง/บังคับ/ชื่อช่อง — ร้านตั้งเองในหลังบ้าน › การ์ด › ฟอร์มสมัครสมาชิก
  const rf = resolveRegisterForm(config.registerForm);
  /** ป้าย (ไม่บังคับ) ต่อท้ายชื่อช่องที่ร้านตั้งว่าไม่บังคับ */
  const optTag = (on: boolean) =>
    on ? null : <span className="font-normal text-brown-faint"> (ไม่บังคับ)</span>;
  const referrals = config.options?.referralOptions?.length
    ? config.options.referralOptions
    : REFERRAL_OPTIONS;
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
    const catProblem = (c: CatInput, n: string): string => {
      if (!c.name.trim()) return `กรอกชื่อน้องแมว${n}ด้วยนะคะ`;
      if (rf.gender.required && !c.gender) return `เลือกเพศน้องแมว${n}ด้วยนะคะ 🐱`;
      if (rf.breed.required && (!c.breed || (c.breed === OTHER_BREED && !c.breedOther.trim())))
        return `เลือกสายพันธุ์น้องแมว${n}ด้วยนะคะ`;
      if (rf.furLength.required && !c.furLength) return `เลือกลักษณะขนน้องแมว${n}ด้วยนะคะ`;
      if (rf.neutered.required && !c.neutered) return `เลือกว่าน้องแมว${n}ทำหมันแล้วหรือยังด้วยนะคะ`;
      if (rf.color.required && !c.color.trim()) return `กรอกสี/ลักษณะเด่นน้องแมว${n}ด้วยนะคะ`;
      if (rf.age.required && !c.ageUnknown && !(Number(c.ageValue) > 0))
        return `กรอกอายุน้องแมว${n} หรือติ๊ก "ไม่ทราบ" ด้วยนะคะ`;
      if (rf.weight.required && !c.weightUnknown && !(Number(c.weightKg) > 0))
        return `กรอกน้ำหนักน้องแมว${n} หรือติ๊ก "ไม่ทราบ" ด้วยนะคะ`;
      if (rf.medical.required && !c.medical.trim() && !c.note.trim())
        return `เลือกโรคประจำตัวน้องแมว${n} (ไม่มีก็เลือก/พิมพ์ว่า "ไม่มี") ด้วยนะคะ`;
      if (rf.seizure.required && !c.seizureHistory.trim())
        return `กรอกประวัติการชัก/ช็อคน้องแมว${n} (ไม่มีพิมพ์ว่า "ไม่มี") ด้วยนะคะ`;
      if (rf.allergy.required && !c.allergy.trim())
        return `กรอกประวัติการแพ้น้องแมว${n} (ไม่มีพิมพ์ว่า "ไม่มี") ด้วยนะคะ`;
      return "";
    };
    for (let i = 0; i < cats.length; i++) {
      const problem = catProblem(cats[i], cats.length > 1 ? ` ตัวที่ ${i + 1}` : "");
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (rf.email.required && !email.trim()) {
      setError("กรอกอีเมลด้วยนะคะ");
      return;
    }
    if (rf.ownerBirthday.required && !birthday) {
      setError("เลือกวันเกิดผู้ปกครองด้วยนะคะ");
      return;
    }
    if (rf.postalCode.required ? !/^\d{5}$/.test(postalCode) : postalCode && !/^\d{5}$/.test(postalCode)) {
      setError("กรอกรหัสไปรษณีย์ 5 หลักด้วยนะคะ");
      return;
    }
    if (rf.referral.enabled && rf.referral.required && !referral) {
      setError("เลือกช่องทางที่รู้จักเราด้วยนะคะ");
      return;
    }
    if (referralOn && hasReferralCode && !referralCode.trim()) {
      setError("กรอกโค้ดเพื่อนแนะนำ หรือเอาติ๊กออกถ้าไม่มีโค้ดนะคะ");
      return;
    }

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
        setError(data.error || "ลงทะเบียนไม่สำเร็จ — ลองใหม่อีกครั้งนะคะ");
        return;
      }

      await refreshCustomer();
      await refreshAccount();
      router.replace("/app");
    } catch {
      setError(
        "เชื่อมต่อไม่สำเร็จ — เช็คสัญญาณอินเทอร์เน็ตแล้วลองกดบันทึกอีกครั้งนะคะ"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <LoadingScreen message="กำลังเชื่อมต่อ LINE…" />;
  }

  const fieldClass =
    "min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm";
  const subFieldClass =
    "min-h-[44px] w-full rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm";

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Sign up"
        title="สมัครสมาชิก เพื่อรับสิทธิพิเศษ"
        subtitle="กรอกข้อมูลครั้งเดียว — ใช้ยืนยันนัด แต้มสะสม และโปรโมชั่น"
        back="/app"
        backLabel="กลับหน้าแรก"
        showLang={false}
      />

      {fromLink && referralOn && (
        <div className="mb-4 flex items-start gap-2 rounded-catcha border border-honey/50 bg-honey/20 px-4 py-3 text-xs font-extrabold text-catcha-chocolate">
          <Icon name="gift" size={16} className="mt-px" />
          <span>สมัครผ่านเพื่อนแนะนำ — สมัครเสร็จรับคูปองส่วนลด <span className="text-latte-deep">{referralReward(config).amount}฿</span> ทั้งคุณและเพื่อนทันที!</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* ── ข้อมูลผู้ปกครอง ── */}
        <section>
        <SectionLabel>Owner · ข้อมูลผู้ปกครอง</SectionLabel>
        <div className="space-y-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">
            {rf.ownerName.label}{" "}
            <span className="font-normal text-brown-faint">
              (ชื่อเล่นหรือชื่อจริงก็ได้นะคะ)
            </span>
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น คุณมาย"
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
            placeholder="เช่น 10540"
            className={fieldClass}
          />
        </label>
        )}
        </div>
        </section>

        {/* ── น้องแมว ── */}
        <section>
          <SectionLabel>My cats · น้องแมว</SectionLabel>
          <ul className="space-y-3">
            {cats.map((cat, idx) => (
              <li
                key={idx}
                className="space-y-2.5 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm"
              >
                {cats.length > 1 && (
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-catcha-chocolate">
                    <Icon name="paw" size={14} />
                    ตัวที่ {idx + 1}
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
                      ["male", "♂ ผู้"],
                      ["female", "♀ เมีย"],
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
                  <option value="">เลือกสายพันธุ์…</option>
                  {breeds.map((b) => (
                    <option key={b} value={b} className="text-brown">
                      {b}
                    </option>
                  ))}
                  <option value={OTHER_BREED} className="text-brown">
                    {OTHER_BREED}
                  </option>
                </select>
                {cat.breed === OTHER_BREED && (
                  <input
                    required
                    value={cat.breedOther}
                    onChange={(e) => updateCat(idx, { breedOther: e.target.value })}
                    placeholder="ระบุสายพันธุ์"
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
                        ["short", "ขนสั้น"],
                        ["long", "ขนยาว"],
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
                        ["yes", "ทำหมันแล้ว"],
                        ["no", "ยังไม่ทำ"],
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
                  placeholder="เช่น สีขาวสลับดำ"
                  className={`${subFieldClass} mt-0.5 font-normal text-brown`}
                />
                </div>
                )}
                {rf.age.enabled && (
                <>
                <div className="text-[11px] font-bold text-brown-soft">
                  {rf.age.label}{optTag(rf.age.required)}
                  <div className="mt-0.5 flex items-center gap-2">
                    <input
                      disabled={cat.ageUnknown}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={cat.ageUnknown ? "" : cat.ageValue}
                      onChange={(e) => updateCat(idx, { ageValue: e.target.value })}
                      placeholder={cat.ageUnknown ? "ไม่ทราบอายุ" : "อายุ"}
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
                        <option value="year">ปี</option>
                        <option value="month">เดือน</option>
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
                      ไม่ทราบ
                    </label>
                  </div>
                </div>
                {!cat.ageUnknown && (
                  <div className="text-[11px] font-bold text-brown-soft">
                    วันเกิดน้องแมว{" "}
                    <span className="font-normal text-brown-faint">
                      (ถ้าทราบ · ไม่บังคับ)
                    </span>
                    <div className="mt-0.5">
                      <BirthdayPicker
                        value={cat.birthday}
                        onChange={(iso) => updateCat(idx, { birthday: iso })}
                        yearsBack={25}
                        allowUnknown
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
                    <input
                      required={rf.weight.required && !cat.weightUnknown}
                      disabled={cat.weightUnknown}
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={cat.weightUnknown ? "" : cat.weightKg}
                      onChange={(e) => updateCat(idx, { weightKg: e.target.value })}
                      placeholder={cat.weightUnknown ? "ไม่ทราบน้ำหนัก" : "เช่น 4.5"}
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
                      ไม่ทราบ
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
                />
                )}
                {rf.seizure.enabled && (
                <label className="block text-[11px] font-bold text-brown-soft">
                  {rf.seizure.label}{" "}
                  <span className="font-normal text-brown-faint">
                    {rf.seizure.required ? "(ไม่มีพิมพ์ว่า ไม่มี)" : "(ไม่มีเว้นว่างได้)"}
                  </span>
                  <input
                    value={cat.seizureHistory}
                    onChange={(e) => updateCat(idx, { seizureHistory: e.target.value })}
                    placeholder="เช่น ไม่เคย · หรือ เคยชักตอนตกใจ"
                    className={`${subFieldClass} mt-0.5 font-normal text-brown`}
                  />
                </label>
                )}
                {rf.allergy.enabled && (
                <label className="block text-[11px] font-bold text-brown-soft">
                  {rf.allergy.label}{" "}
                  <span className="font-normal text-brown-faint">
                    {rf.allergy.required ? "(ไม่มีพิมพ์ว่า ไม่มี)" : "(ไม่มีเว้นว่างได้)"}
                  </span>
                  <input
                    value={cat.allergy}
                    onChange={(e) => updateCat(idx, { allergy: e.target.value })}
                    placeholder="เช่น ไม่มี · หรือ แพ้ไก่ แพ้แชมพูบางยี่ห้อ"
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
                    ลบน้องแมวตัวนี้
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
              <span className="block text-sm font-extrabold">เพิ่มน้องแมวอีกตัว</span>
              <span className="block text-[11px] text-catcha-chocolate/70">มีหลายตัว เพิ่มได้ทุกตัวเลยค่ะ</span>
            </span>
            <Icon name="paw" size={22} className="text-catcha-chocolate/60" />
          </button>
        </section>

        {/* ── รู้จักเราจากทางไหน ── */}
        {rf.referral.enabled && (
        <section>
          <SectionLabel>
            Referral · {rf.referral.label}{" "}
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
                {opt}
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
              มีโค้ดเพื่อนแนะนำ
              <span className="block text-[11px] font-normal text-brown-faint">
                กรอกโค้ด รับคูปอง {referralReward(config).amount}฿ ทั้งคุณและเพื่อน
              </span>
            </span>
          </label>
          {hasReferralCode && (
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
              placeholder="เช่น CAT1A2B3C"
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
            ยินยอมให้ส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษ
            <span className="mt-0.5 block text-[11px] text-brown-faint">
              ถ้าไม่ยินยอม จะไม่ได้รับโปร/ข่าวสาร แต่ยังได้รับการยืนยันนัดและแจ้งชำระเงินตามปกติ
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
          {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
        </button>
      </form>
    </div>
  );
}
