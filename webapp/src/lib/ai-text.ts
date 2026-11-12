/**
 * เรียก AI เขียนข้อความ — เลือกเจ้าตามคีย์ที่ใส่ไว้ใน Vercel (ไม่ต้องแก้โค้ดตอนเปลี่ยนเจ้า)
 *   OPENAI_API_KEY     → ChatGPT (รุ่นตั้งได้ที่ OPENAI_MODEL ค่าเริ่มต้น gpt-4o-mini)
 *   ANTHROPIC_API_KEY  → Claude (ANTHROPIC_MODEL)
 *   GEMINI_API_KEY     → Gemini (GEMINI_MODEL)
 * ใส่หลายเจ้า = ใช้ตามลำดับข้างบน · AI_PROVIDER=openai|anthropic|gemini บังคับเจ้าได้
 * ไม่มีคีย์เลย = คืน null ให้ฝั่งที่เรียกใช้ข้อความสำเร็จรูปแทน (ฟีเจอร์ไม่พัง)
 */

export type AiProvider = "openai" | "anthropic" | "gemini";

export function aiProvider(): AiProvider | null {
  const forced = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const has = {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };
  if ((forced === "openai" || forced === "anthropic" || forced === "gemini") && has[forced]) return forced;
  if (has.openai) return "openai";
  if (has.anthropic) return "anthropic";
  if (has.gemini) return "gemini";
  return null;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

/** ส่ง system + user prompt ไปให้ AI → ข้อความที่ได้ (ตัดช่องว่างหัวท้ายแล้ว) · ไม่มีคีย์ = null */
export async function generateAiText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string; provider: AiProvider } | null> {
  const provider = aiProvider();
  if (!provider) return null;
  const maxTokens = opts.maxTokens ?? 600;

  if (provider === "openai") {
    const d = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: maxTokens,
        temperature: 0.8,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }
    );
    return { text: String(d?.choices?.[0]?.message?.content || "").trim(), provider };
  }

  if (provider === "anthropic") {
    const d = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": String(process.env.ANTHROPIC_API_KEY), "anthropic-version": "2023-06-01" },
      {
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }
    );
    const text = Array.isArray(d?.content)
      ? d.content.filter((c: { type?: string }) => c.type === "text").map((c: { text?: string }) => c.text || "").join("")
      : "";
    return { text: text.trim(), provider };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const d = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": String(process.env.GEMINI_API_KEY) },
    {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
    }
  );
  const parts = d?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text || "").join("") : "";
  return { text: text.trim(), provider };
}
