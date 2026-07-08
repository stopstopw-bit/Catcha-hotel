export type TelegramFlow = "book" | "room" | "customer" | "expense" | "bill" | "topup";

export type TelegramSession = {
  flow: TelegramFlow;
  step: number;
  data: Record<string, string>;
  updatedAt: number;
};

const sessions = new Map<string, TelegramSession>();
const TTL_MS = 30 * 60 * 1000;

function key(chatId: number | string) {
  return String(chatId);
}

export function getTelegramSession(chatId: number | string) {
  const s = sessions.get(key(chatId));
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) {
    sessions.delete(key(chatId));
    return null;
  }
  return s;
}

export function setTelegramSession(
  chatId: number | string,
  session: Omit<TelegramSession, "updatedAt">
) {
  sessions.set(key(chatId), { ...session, updatedAt: Date.now() });
}

export function clearTelegramSession(chatId: number | string) {
  sessions.delete(key(chatId));
}

export function startFlow(chatId: number | string, flow: TelegramFlow) {
  setTelegramSession(chatId, { flow, step: 0, data: {} });
}
