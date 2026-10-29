import { buildNoticeFlex } from "./line";
import { getLineCredentials } from "./line-config";
import { resolveBroadcastActionUri } from "./line-broadcast";
import {
  BIRTHDAY_CARD_DEFAULTS,
  REFERRAL_REWARD_DEFAULTS,
  fillCardText,
} from "./line-card-defaults";
import type { SiteConfig } from "./config-types";

/** ลิงก์กระเป๋าคูปองของลูกค้า (เปิดใน LIFF ถ้าร้านตั้งไว้) */
async function couponsUri() {
  const liffId = (await getLineCredentials().catch(() => null))?.liffId;
  return resolveBroadcastActionUri("coupons", liffId);
}

/** การ์ดแจ้งคนชวนว่าได้คูปองแล้ว — signup = เพื่อนสมัครด้วยโค้ด, visit = เพื่อนมาใช้บริการครั้งแรก */
export async function buildReferralRewardCard(
  kind: "signup" | "visit",
  reward: { amount: number; expiresInDays: number },
  cfg: Pick<SiteConfig, "cards">
) {
  const style = cfg.cards?.referralReward;
  const tx = { ...REFERRAL_REWARD_DEFAULTS, ...style?.texts };
  const vars = { amount: reward.amount, days: reward.expiresInDays };
  return buildNoticeFlex(
    {
      header: tx.header,
      body: fillCardText(kind === "signup" ? tx.signupBody : tx.visitBody, vars),
      note: fillCardText(tx.expiry, vars),
      button: { label: tx.button, uri: await couponsUri() },
    },
    style
  );
}

/** การ์ดอวยพรวันเกิด — เนื้อความมาจากแม่แบบวันเกิด (+ บรรทัดคูปองถ้าแจก) มีปุ่มคูปองเฉพาะตอนแจกคูปอง */
export async function buildBirthdayCard(
  text: string,
  withCoupon: boolean,
  cfg: Pick<SiteConfig, "cards">
) {
  const style = cfg.cards?.birthday;
  const tx = { ...BIRTHDAY_CARD_DEFAULTS, ...style?.texts };
  return buildNoticeFlex(
    {
      header: tx.header,
      body: text,
      button: withCoupon ? { label: tx.button, uri: await couponsUri() } : undefined,
      altText: text.split("\n")[0],
    },
    style
  );
}
