/**
 * ข้อตกลงฉบับภาษาอังกฤษ — ลูกค้าที่เลือก English เห็นข้อตกลงเป็นอังกฤษ
 * ใช้เฉพาะตอนร้านยังใช้ข้อความเริ่มต้น · ถ้าร้านแก้ข้อตกลงเองในหลังบ้าน จะแสดงข้อความที่ร้านพิมพ์ (ภาษาไทย)
 */
import {
  DEEMED_CONSENT_NOTICE,
  DEEMED_GROOM_CONSENT_NOTICE,
  DEFAULT_MESSAGES,
  GROOM_CONSENT_CONFIRM,
  consentTextFor,
} from "@/lib/messages";
import type { MessagesConfig } from "@/lib/config-types";

export const CONSENT_TITLE_EN = "Boarding terms and conditions";
export const GROOM_CONSENT_TITLE_EN = "Terms and conditions for cat grooming";

export const CONSENT_TERMS_EN = [
  "The hotel promises to care for every cat in line with the law, including the Prevention of Animal Cruelty and Provision of Animal Welfare Act B.E. 2557 (2014), and to keep the premises strictly hygienic.",
  "The hotel will take the very best care of your cat, but is not responsible for illness, accidents or injuries caused by existing health conditions or the cat's own behaviour, such as biting, scratching or rough play.",
  "The hotel is not responsible if a cat becomes ill or dies due to events beyond its control, such as natural disasters, hidden illnesses the cat had before the stay, or emergencies outside the hotel's control.",
  "If a cat is found to have a contagious disease, ticks or fleas, the hotel may separate the cat from shared areas to prevent spread, and the owner is responsible for any resulting damage.",
  "If a cat becomes ill during the stay, the hotel will inform the owner as soon as anything unusual is noticed and coordinate with an animal hospital. The owner agrees to pay all treatment costs (examination, medicine, recovery, etc.). If the owner cannot be reached, the hotel will arrange emergency treatment at the veterinarian's discretion.",
  "For cats at risk of dying during the stay, such as terminally ill or very elderly cats, the hotel reserves the right to accept no liability in any case.",
  "Cancellations or changes must be made 5–10 days in advance, and a fee may apply as set by the hotel.",
  "The owner agrees to be responsible for any damage the cat causes to hotel property.",
  "The hotel is not responsible for the owner's personal items left with the cat, such as collars, toys or other accessories.",
  "If a pet is intentionally not collected as scheduled or is abandoned, the hotel will act under the Animal Protection Act and may take any reasonable action at its discretion.",
  "If the owner does not upload the cat's vaccine book, the owner acknowledges and accepts all terms, including the risk that the hotel has not checked the vaccination history.",
];

export const GROOM_CONSENT_TERMS_EN = [
  "Health and existing conditions — Owners must truthfully disclose any health conditions, drug or product allergies, skin conditions, illnesses and precautions. For cats that are unwell or suspected of a contagious disease, the shop reserves the right to refuse or postpone the service.",
  "Stress and behaviour — Bathing may cause stress, fear or changes in behaviour. If a cat shows severe stress, aggression, abnormal breathing or a health risk, the shop reserves the right to stop the service immediately for safety.",
  "Skin and coat condition — With matted or tangled fur or skin problems, brushing or trimming may cause irritation or reveal existing hidden wounds. The shop will inform the owner if anything unusual is found or extra services are needed.",
  "Safety during the service — The cat's safety is our top priority and we handle every cat with care. However, allergies, irritation, stress or symptoms of previously hidden conditions may still occur.",
  "Emergencies — In an emergency the shop will contact the owner as quickly as possible. If the owner cannot be reached and urgent treatment is needed, the owner consents to the shop taking the cat to a veterinarian, with costs and responsibility determined by the cause and facts of the incident.",
  "Stopping the service and fees — If the bath cannot be completed because of the cat's health or behaviour, the shop will inform the owner with a summary of the steps completed and a fair service charge.",
  "Scope of responsibility — Owners acknowledge the natural risks of bathing and grooming cats. The shop remains legally responsible for any damage caused by its own negligence.",
];

export const DEEMED_CONSENT_NOTICE_EN =
  "If you do not reply, upload the documents or accept the terms by the check-in date but still bring your cat for the stay as booked, " +
  "the shop will consider that you have received this message and acknowledged and accepted all boarding terms and conditions from the date you received it. " +
  "This message is binding and may be used as legal evidence of the agreement between you and the shop.";

export const DEEMED_GROOM_CONSENT_NOTICE_EN =
  "If you do not reply or accept the terms by the grooming date but still bring your cat as booked, " +
  "the shop will consider that you have acknowledged and accepted all grooming terms and conditions from the date you received this message, " +
  "and this message may be used as legal evidence of the agreement between you and the shop.";

export const GROOM_CONSENT_CONFIRM_EN =
  "I confirm that I have read, understood and accept all service terms, " +
  "and that the health and behaviour information I gave about my cat is true.";

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x.trim() === b[i].trim());

/** หัวเรื่อง + ข้อตกลงตามภาษาลูกค้า — อังกฤษเฉพาะส่วนที่ร้านยังใช้ข้อความเริ่มต้น */
export function consentTextForLocale(
  m: Partial<MessagesConfig> | undefined,
  service: string | undefined,
  locale: string | undefined
): { title: string; terms: string[] } {
  const th = consentTextFor(m, service);
  if (locale !== "en") return th;
  const groom = service === "groom";
  const defTitle = groom ? DEFAULT_MESSAGES.groomConsentTitle : DEFAULT_MESSAGES.consentTitle;
  const defTerms = groom ? DEFAULT_MESSAGES.groomConsentTerms : DEFAULT_MESSAGES.consentTerms;
  return {
    title: th.title === defTitle ? (groom ? GROOM_CONSENT_TITLE_EN : CONSENT_TITLE_EN) : th.title,
    terms: same(th.terms, defTerms) ? (groom ? GROOM_CONSENT_TERMS_EN : CONSENT_TERMS_EN) : th.terms,
  };
}

export function consentNoticesFor(locale: string | undefined) {
  const en = locale === "en";
  return {
    deemed: en ? DEEMED_CONSENT_NOTICE_EN : DEEMED_CONSENT_NOTICE,
    deemedGroom: en ? DEEMED_GROOM_CONSENT_NOTICE_EN : DEEMED_GROOM_CONSENT_NOTICE,
    groomConfirm: en ? GROOM_CONSENT_CONFIRM_EN : GROOM_CONSENT_CONFIRM,
  };
}
