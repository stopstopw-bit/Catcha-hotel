/** การ์ด LINE ชวนลูกค้าเล่นเกมลุ้นรางวัล (วงล้อ / ขูดบัตร) — ข้อความ/สีแก้ได้ใน /admin/cards (key "game") */
import type { CardStyleConfig } from "./config-types";
import type { GameCampaign } from "./game-types";

const BRAND_GREEN = "#5A8F5A";
const BRAND_GREEN_DARK = "#4A7348";

export function buildGameInviteFlex(game: GameCampaign, url: string, style?: CardStyleConfig) {
  const wheel = game.type === "wheel";
  const prizes = game.prizes.filter((p) => p.kind !== "none").map((p) => p.label);
  const header = style?.texts?.header?.trim() || (wheel ? "🎡 หมุนวงล้อลุ้นรางวัล" : "🎟️ ขูดบัตรลุ้นรางวัล");
  const button = style?.texts?.button?.trim() || (wheel ? "🎡 กดหมุนเลย" : "🎟️ กดขูดเลย");
  const limit =
    game.period === "day"
      ? `เล่นได้วันละ ${game.playsPerCustomer} ครั้ง`
      : `เล่นได้ ${game.playsPerCustomer} ครั้ง`;
  return {
    type: "flex",
    altText: `${header} — ${game.title}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: style?.headerColor || BRAND_GREEN,
        paddingAll: "16px",
        contents: [
          { type: "text", text: header, color: style?.headerTextColor || "#FFFFFF", weight: "bold", size: "sm", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: game.title,
            weight: "bold",
            size: style?.titleSize || "lg",
            color: style?.accentColor || "#5C4033",
            wrap: true,
          },
          ...(game.subtitle
            ? [{ type: "text", text: game.subtitle, size: "sm", color: "#4E3E32", margin: "md", wrap: true }]
            : []),
          ...(prizes.length
            ? [
                {
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  paddingAll: "12px",
                  backgroundColor: "#FBF4E9",
                  cornerRadius: "12px",
                  contents: [
                    { type: "text", text: style?.texts?.prizesLabel?.trim() || "รางวัลที่ลุ้นได้", size: "xs", color: "#A2907E" },
                    { type: "text", text: prizes.join(" · "), size: "sm", weight: "bold", color: "#5C4033", wrap: true, margin: "sm" },
                  ],
                },
              ]
            : []),
          {
            type: "text",
            text: `${style?.closing || "สมาชิกเล่นฟรี ได้รางวัลเข้ากระเป๋าคูปองทันที"} (${limit}${
              game.endDate ? ` ถึง ${game.endDate.split("-").reverse().join("/")}` : ""
            }) 🧡`,
            size: "xs",
            color: "#A2907E",
            margin: "lg",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: style?.buttonColor || BRAND_GREEN_DARK,
            height: "sm",
            action: { type: "uri", label: button.slice(0, 40), uri: url },
          },
        ],
      },
    },
  };
}
