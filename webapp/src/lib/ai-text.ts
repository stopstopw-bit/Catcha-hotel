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
  temperature?: number;
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
        temperature: opts.temperature ?? 1,
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

  return generateGemini(opts.system, opts.prompt, maxTokens, opts.temperature ?? 1);
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
/** รุ่นที่ใช้ได้ล่าสุด (จำไว้ในเครื่องเซิร์ฟเวอร์ ไม่ต้องหาใหม่ทุกครั้ง) */
let geminiWorking: string | null = null;

/** ถามรายชื่อรุ่นจาก Google เอง → รุ่น flash ที่เขียนข้อความได้ ใหม่สุดก่อน (Google เลิกรุ่นเก่าบ่อย) */
async function discoverGeminiModels(key: string): Promise<string[]> {
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
    const d = await res.json().catch(() => ({}));
    const list: { name?: string; supportedGenerationMethods?: string[] }[] = Array.isArray(d?.models) ? d.models : [];
    const ver = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || "0");
    return list
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|embed|thinking|exp/.test(n))
      .sort((a, b) => {
        // ใหม่สุดก่อน · รุ่นปกติก่อน lite · รุ่นจริงก่อน preview
        const score = (n: string) => ver(n) * 100 - (/lite/.test(n) ? 10 : 0) - (/preview/.test(n) ? 5 : 0);
        return score(b) - score(a);
      })
      .slice(0, 4);
  } catch {
    return [];
  }
}

async function callGemini(model: string, key: string, system: string, prompt: string, maxTokens: number, temperature: number, thinkingOff: boolean) {
  const d = await postJson(
    `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": key },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: Math.max(maxTokens, 4096),
        temperature,
        // รุ่น 2.5 ปิดโหมดคิดได้ (ไม่งั้นกิน token จนตอบว่าง) · รุ่นใหม่กว่าไม่ส่งค่านี้ กันโดนปฏิเสธ
        ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }
  );
  const parts = d?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter((p: { thought?: boolean }) => !p.thought)
        .map((p: { text?: string }) => p.text || "")
        .join("")
        .trim()
    : "";
  if (!text) {
    throw new Error(`ตอบว่าง (${d?.candidates?.[0]?.finishReason || d?.promptFeedback?.blockReason || "no text"})`);
  }
  return text;
}

/**
 * Gemini — ลองตามลำดับ: GEMINI_MODEL → รุ่นที่ใช้ได้ครั้งก่อน → gemini-flash-latest → รุ่นที่ Google แนะนำในข้อความ error
 * → รุ่น flash ใหม่สุดจากรายชื่อของ Google เอง · Google เลิกรุ่นเก่าเมื่อไหร่ก็ไม่ต้องแก้โค้ด
 */
async function generateGemini(system: string, prompt: string, maxTokens: number, temperature: number) {
  const key = String(process.env.GEMINI_API_KEY);
  const tried = new Set<string>();
  const errors: string[] = [];
  const queue = [process.env.GEMINI_MODEL, geminiWorking, "gemini-flash-latest"].filter((m): m is string => !!m);
  let discovered = false;

  while (tried.size < 8) {
    let model = queue.shift();
    if (!model && !discovered) {
      discovered = true;
      queue.push(...(await discoverGeminiModels(key)));
      model = queue.shift();
    }
    if (!model) break;
    if (tried.has(model)) continue;
    tried.add(model);
    const thinkingOff = /^gemini-2\.5/.test(model);
    try {
      let text: string;
      try {
        text = await callGemini(model, key, system, prompt, maxTokens, temperature, thinkingOff);
      } catch (e) {
        // รุ่นไหนไม่ยอมให้ปิดโหมดคิด → ลองใหม่แบบไม่ส่งค่านั้น
        if (thinkingOff && /thinking/i.test(e instanceof Error ? e.message : "")) {
          text = await callGemini(model, key, system, prompt, maxTokens, temperature, false);
        } else throw e;
      }
      geminiWorking = model;
      return { text, provider: "gemini" as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${model}: ${msg.slice(0, 160)}`);
      if (geminiWorking === model) geminiWorking = null;
      // คีย์ผิด/โควต้าหมด เปลี่ยนรุ่นก็ไม่ช่วย
      if (/API key|PERMISSION_DENIED|RESOURCE_EXHAUSTED|quota|billing/i.test(msg)) break;
      // Google บอกชื่อรุ่นใหม่มาใน error → ลองรุ่นนั้นถัดไปเลย
      const hint = [...msg.matchAll(/use\s+(?:models\/)?(gemini-[\w.-]*\w)/gi)].map((x) => x[1]).filter((x) => x !== model);
      if (hint.length) queue.unshift(...hint);
    }
  }
  throw new Error(errors.length ? errors.join(" | ") : "Gemini error");
}
