"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useL } from "@/components/LocaleProvider";
import { customerFetch } from "@/lib/customer-fetch";
import { AFTER_REGISTER_KEY, WHEEL_COLORS, type GamePlayResult, type PublicGame } from "@/lib/game-types";

type Info = {
  game: PublicGame;
  registered: boolean;
  playsLeft: number;
  last: { label: string; kind: string; amount: number } | null;
};

const SPIN_MS = 4800;

// ── วงล้อ ──────────────────────────────────────────────

function Wheel({ prizes, rotation, spinning }: { prizes: PublicGame["prizes"]; rotation: number; spinning: boolean }) {
  const n = prizes.length;
  const seg = 360 / n;
  const r = 150;
  const point = (deg: number, rad = r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [160 + rad * Math.cos(a), 160 + rad * Math.sin(a)];
  };
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      {/* ลูกศรชี้ด้านบน */}
      <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2">
        <svg width="34" height="40" viewBox="0 0 34 40" aria-hidden>
          <path d="M17 38 L3 8 A14 14 0 1 1 31 8 Z" fill="#5c4033" />
          <circle cx="17" cy="12" r="5" fill="#ebc583" />
        </svg>
      </div>
      <svg
        viewBox="0 0 320 320"
        className="h-full w-full drop-shadow-[0_8px_18px_rgba(92,64,51,0.18)]"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.7, 0.1, 1)` : "none",
        }}
        aria-hidden
      >
        <circle cx="160" cy="160" r="158" fill="#5c4033" />
        {prizes.map((p, i) => {
          const [x1, y1] = point(i * seg);
          const [x2, y2] = point((i + 1) * seg);
          const mid = i * seg + seg / 2;
          const [tx, ty] = point(mid, r * 0.6);
          const fill = p.color || WHEEL_COLORS[i % WHEEL_COLORS.length];
          return (
            <g key={p.id}>
              <path
                d={`M160 160 L${x1} ${y1} A${r} ${r} 0 ${seg > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                fill={fill}
                stroke="#fffdfa"
                strokeWidth="2"
              />
              <text
                x={tx}
                y={ty}
                transform={`rotate(${mid - 90} ${tx} ${ty})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={n > 8 ? 11 : 13}
                fontWeight={800}
                fill="#5c4033"
              >
                {p.label.length > 16 ? `${p.label.slice(0, 15)}…` : p.label}
              </text>
            </g>
          );
        })}
        <circle cx="160" cy="160" r="26" fill="#fffdfa" stroke="#5c4033" strokeWidth="4" />
        <text x="160" y="161" textAnchor="middle" dominantBaseline="middle" fontSize="20">
          🐾
        </text>
      </svg>
    </div>
  );
}

// ── บัตรขูด ─────────────────────────────────────────────

function ScratchCard({
  result,
  onReveal,
  armed,
}: {
  result: GamePlayResult | null;
  onReveal: () => void;
  /** ได้ผลจากเซิร์ฟเวอร์แล้ว → ขูดได้ */
  armed: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const revealed = useRef(false);
  const { L } = useL();

  // เคลือบหน้าบัตร
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    revealed.current = false;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#e0ad5a");
    g.addColorStop(0.5, "#f5d76e");
    g.addColorStop(1, "#c7a583");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,253,250,0.35)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#5c4033";
    ctx.font = "800 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(L("🐾 ขูดตรงนี้ 🐾", "🐾 Scratch here 🐾"), w / 2, h / 2);
  }, [L]);

  const clearedRatio = () => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    let clear = 0;
    // สุ่มเช็คทุก 32 พิกเซล พอสำหรับประมาณสัดส่วน
    for (let i = 3; i < data.length; i += 4 * 32) if (data[i] === 0) clear++;
    return clear / (data.length / (4 * 32));
  };

  const scratchAt = (clientX: number, clientY: number) => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || !armed || revealed.current) return;
    const rect = cv.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(clientX - rect.left, clientY - rect.top, 22, 0, Math.PI * 2);
    ctx.fill();
  };

  const finish = () => {
    drawing.current = false;
    if (!armed || revealed.current) return;
    if (clearedRatio() > 0.55) {
      revealed.current = true;
      const cv = canvasRef.current;
      if (cv) cv.style.opacity = "0";
      onReveal();
    }
  };

  return (
    <div className="relative mx-auto h-44 w-full max-w-[320px] overflow-hidden rounded-catcha border-4 border-catcha-chocolate bg-card shadow-catcha">
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        {result ? (
          <>
            <p className="text-xs font-bold text-brown-soft">
              {result.kind === "none" ? L("ผลรอบนี้", "This round") : L("ยินดีด้วย! ได้รับ", "Congrats! You got")}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-latte-deep">{result.label}</p>
          </>
        ) : (
          <p className="text-sm font-bold text-brown-soft">{L("กดปุ่มด้านล่างเพื่อเริ่มขูด", "Tap the button below to start")}</p>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none transition-opacity duration-500"
        onPointerDown={(e) => {
          drawing.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
          scratchAt(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => drawing.current && scratchAt(e.clientX, e.clientY)}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
    </div>
  );
}

// ── หน้าเกม ─────────────────────────────────────────────

function GameContent() {
  const params = useSearchParams();
  const router = useRouter();
  const gameId = params.get("g") || "";
  const { ready, profile, needsRegistration } = useLiff();
  const { L } = useL();

  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GamePlayResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [scratchKey, setScratchKey] = useState(0);

  const load = useCallback(async () => {
    if (!gameId) return setLoading(false);
    const q = new URLSearchParams({ g: gameId });
    if (profile?.lineUserId) q.set("lineUserId", profile.lineUserId);
    try {
      const r = await customerFetch(`/api/games/play?${q}`, { cache: "no-store" });
      const d = await r.json().catch(() => null);
      setInfo(d?.found ? (d as Info) : null);
    } finally {
      setLoading(false);
    }
  }, [gameId, profile?.lineUserId]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const goRegister = () => {
    try {
      sessionStorage.setItem(AFTER_REGISTER_KEY, `/app/game?g=${encodeURIComponent(gameId)}`);
    } catch {}
    router.push("/app/register");
  };

  const errorText = (code: string) => {
    if (code === "no_plays_left") return L("ใช้สิทธิ์ครบแล้วนะคะ", "You've used all your plays");
    if (code === "ended") return L("แคมเปญนี้จบแล้วค่ะ", "This campaign has ended");
    if (code === "not_started") return L("แคมเปญยังไม่เริ่มค่ะ", "This campaign hasn't started yet");
    if (code === "closed") return L("แคมเปญปิดอยู่ค่ะ", "This campaign is closed");
    if (code === "no_customer") return L("สมัครสมาชิกก่อนนะคะ", "Please sign up first");
    return L("ระบบไม่ว่าง ลองใหม่อีกครั้งนะคะ", "Something went wrong, please try again");
  };

  const play = async (): Promise<GamePlayResult | null> => {
    setBusy(true);
    setError("");
    try {
      const res = await customerFetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, lineUserId: profile?.lineUserId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) return d.result as GamePlayResult;
      setError(d.code === "no_session" ? d.error : errorText(d.error || ""));
      if (d.error === "no_plays_left") load();
      return null;
    } catch {
      setError(errorText(""));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const spin = async () => {
    if (!info || spinning || busy) return;
    setShowResult(false);
    const r = await play();
    if (!r) return;
    const n = info.game.prizes.length;
    const seg = 360 / n;
    const idx = Math.max(0, info.game.prizes.findIndex((p) => p.id === r.prizeId));
    // หยุดให้กลางช่อง (เหลื่อมนิดหน่อยให้ดูเป็นธรรมชาติ) ใต้ลูกศรด้านบน
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = 360 - (idx * seg + seg / 2 + jitter);
    const base = rotation - (rotation % 360);
    setResult(r);
    setSpinning(true);
    setRotation(base + 360 * 6 + ((target % 360) + 360) % 360);
    setTimeout(() => {
      setSpinning(false);
      setShowResult(true);
      setInfo((i) => (i ? { ...i, playsLeft: r.playsLeft, last: { label: r.label, kind: r.kind, amount: r.amount } } : i));
    }, SPIN_MS + 150);
  };

  const startScratch = async () => {
    if (!info || busy) return;
    setShowResult(false);
    setResult(null);
    setScratchKey((k) => k + 1);
    const r = await play();
    if (r) setResult(r);
  };

  const onScratchReveal = () => {
    if (!result) return;
    setShowResult(true);
    setInfo((i) => (i ? { ...i, playsLeft: result.playsLeft, last: { label: result.label, kind: result.kind, amount: result.amount } } : i));
  };

  if (!ready || loading) return <LoadingScreen />;

  if (!info)
    return (
      <div className="px-4 pb-6 pt-5">
        <PageHeader eyebrow="Game" title={L("เกมลุ้นรางวัล", "Prize game")} back="/app" showLang={false} />
        <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <EmptyState icon="gift" title={L("ไม่พบเกมนี้", "Game not found")} sub={L("หรือแคมเปญปิดไปแล้วค่ะ", "or the campaign has ended")} />
        </div>
      </div>
    );

  const { game } = info;
  const wheel = game.type === "wheel";
  const open = game.status === "open";
  const canPlay = open && info.registered && !needsRegistration && info.playsLeft > 0;
  const fmt = (d?: string) => (d ? d.split("-").reverse().join("/") : "");
  const limitText =
    game.period === "day"
      ? L(`เล่นได้วันละ ${game.playsPerCustomer} ครั้ง`, `${game.playsPerCustomer} play(s) per day`)
      : L(`เล่นได้ ${game.playsPerCustomer} ครั้ง`, `${game.playsPerCustomer} play(s) in total`);
  const statusText =
    game.status === "not_started"
      ? L(`เริ่มเล่นได้ ${fmt(game.startDate)}`, `Starts ${fmt(game.startDate)}`)
      : game.status === "ended"
        ? L("แคมเปญนี้จบแล้วค่ะ ขอบคุณที่ร่วมสนุกนะคะ", "This campaign has ended. Thanks for playing!")
        : game.status === "closed"
          ? L("แคมเปญปิดอยู่ค่ะ", "This campaign is closed")
          : "";

  const shownResult = showResult ? result : null;

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow={wheel ? "Lucky Wheel" : "Scratch & Win"}
        title={game.title}
        subtitle={game.subtitle}
        back="/app"
        showLang={false}
      />

      <div className="relative overflow-hidden rounded-catcha border border-honey/50 bg-gradient-to-br from-honey/30 via-card to-latte/15 px-4 pb-5 pt-6 shadow-catcha">
        {wheel ? (
          <Wheel prizes={game.prizes} rotation={rotation} spinning={spinning} />
        ) : (
          <ScratchCard key={scratchKey} result={result} armed={Boolean(result)} onReveal={onScratchReveal} />
        )}
        <p className="mt-4 text-center text-xs font-bold text-brown-soft">
          {limitText}
          {game.endDate ? L(` · ถึง ${fmt(game.endDate)}`, ` · until ${fmt(game.endDate)}`) : ""}
          {info.registered && open ? L(` · เหลือ ${info.playsLeft} ครั้ง`, ` · ${info.playsLeft} left`) : ""}
        </p>
        {!wheel && result && !showResult && (
          <p className="mt-1 text-center text-xs font-extrabold text-latte-deep">{L("ใช้นิ้วขูดบัตรได้เลย 👆", "Scratch the card with your finger 👆")}</p>
        )}
      </div>

      {shownResult && (
        <div className={`${CARD} mt-4 animate-pop text-center`}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-honey/40 text-2xl">
            {shownResult.kind === "none" ? "🐾" : "🎉"}
          </span>
          <p className="mt-2 text-lg font-extrabold text-catcha-chocolate">
            {shownResult.kind === "none" ? shownResult.label : L(`ได้รับ ${shownResult.label}`, `You won ${shownResult.label}`)}
          </p>
          <p className="mt-1 text-sm text-brown-soft">
            {shownResult.kind === "coupon"
              ? L(
                  `คูปองเข้ากระเป๋าคูปองแล้ว ใช้ได้ ${shownResult.validDays || 30} วัน แจ้งพนักงานตอนชำระเงินได้เลย 🧡`,
                  `The coupon is in your wallet, valid ${shownResult.validDays || 30} days. Show it when you pay 🧡`
                )
              : shownResult.kind === "points"
                ? L("แต้มเข้าบัญชีแล้ว 🧡", "Points added to your account 🧡")
                : L("ไม่เป็นไรนะคะ ไว้ลุ้นใหม่รอบหน้า 🧡", "Better luck next time 🧡")}
          </p>
          {shownResult.kind === "coupon" && (
            <Link href="/app/coupons" className={`mt-4 ${BTN_SECONDARY}`}>
              <Icon name="wallet" size={18} />
              {L("ดูกระเป๋าคูปอง", "View coupon wallet")}
            </Link>
          )}
          {shownResult.kind === "points" && (
            <Link href="/app/points" className={`mt-4 ${BTN_SECONDARY}`}>
              {L("ดูแต้มของฉัน", "View my points")}
            </Link>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-catcha-sm bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">{error}</p>
      )}

      {/* ปุ่มหลักปุ่มเดียว เปลี่ยนตามสถานะ */}
      <div className="mt-5">
        {!open ? (
          <p className={`${CARD} text-center text-sm font-bold text-brown-soft`}>{statusText}</p>
        ) : !info.registered || needsRegistration ? (
          <>
            <button type="button" onClick={goRegister} className={BTN_PRIMARY}>
              <Icon name="gift" size={18} />
              {L("สมัครสมาชิกฟรี แล้วเล่นเลย", "Sign up free to play")}
            </button>
            <p className="mt-2 text-center text-xs text-brown-soft">
              {L("ใช้เวลาไม่ถึง 1 นาที สมัครเสร็จจะพากลับมาที่เกมนี้", "Takes under a minute. We'll bring you back here.")}
            </p>
          </>
        ) : canPlay ? (
          <button
            type="button"
            onClick={wheel ? spin : startScratch}
            disabled={busy || spinning || (!wheel && Boolean(result) && !showResult)}
            className={BTN_PRIMARY}
          >
            {busy || spinning
              ? L("กำลังลุ้น…", "Good luck…")
              : wheel
                ? shownResult
                  ? L("หมุนอีกครั้ง", "Spin again")
                  : L("หมุนเลย!", "Spin!")
                : shownResult
                  ? L("ขอบัตรใบใหม่", "New card")
                  : L("เริ่มขูดบัตร", "Start scratching")}
          </button>
        ) : (
          !spinning &&
          !(result && !showResult) && (
            <div className={`${CARD} text-center`}>
              <p className="text-sm font-bold text-catcha-chocolate">
                {game.period === "day"
                  ? L("วันนี้เล่นครบแล้ว พรุ่งนี้มาลุ้นใหม่นะคะ", "You've played today. Come back tomorrow!")
                  : L("ใช้สิทธิ์ครบแล้ว ขอบคุณที่ร่วมสนุกนะคะ", "You've used all your plays. Thanks for playing!")}
              </p>
              {info.last && !shownResult && (
                <p className="mt-1 text-xs text-brown-soft">{L(`รางวัลล่าสุด: ${info.last.label}`, `Last prize: ${info.last.label}`)}</p>
              )}
              {!shownResult && (
                <Link href="/app/coupons" className={`mt-3 ${BTN_SECONDARY}`}>
                  <Icon name="wallet" size={18} />
                  {L("ดูกระเป๋าคูปอง", "View coupon wallet")}
                </Link>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameContent />
    </Suspense>
  );
}
