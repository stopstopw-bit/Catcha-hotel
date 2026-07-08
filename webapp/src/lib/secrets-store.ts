import { getSupabase } from "./supabase/server";

export type GoogleSecrets = {
  serviceAccountEmail: string;
  privateKey: string;
  calendarId: string;
  spreadsheetId: string;
  updatedAt: string;
};

export type TelegramSecrets = {
  botToken: string;
  ownerChatIds: string[];
  updatedAt: string;
};

export type SecretsPayload = {
  google?: GoogleSecrets;
  telegram?: TelegramSecrets;
};

const SECRETS_ID = "secrets";
let memSecrets: SecretsPayload = {};

export async function getSecrets(): Promise<SecretsPayload> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("site_config")
      .select("data")
      .eq("id", SECRETS_ID)
      .maybeSingle();
    if (data?.data) return data.data as SecretsPayload;
  }
  return memSecrets;
}

export async function saveSecretsPatch(patch: SecretsPayload) {
  const existing = await getSecrets();
  const next: SecretsPayload = { ...existing, ...patch };
  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").upsert({
      id: SECRETS_ID,
      data: next,
      updated_at: new Date().toISOString(),
    });
  } else {
    memSecrets = next;
  }
  return next;
}

export async function saveGoogleSecrets(google: Omit<GoogleSecrets, "updatedAt">) {
  const next = await saveSecretsPatch({
    google: { ...google, updatedAt: new Date().toISOString() },
  });
  return next.google!;
}

export async function saveTelegramSecrets(telegram: Omit<TelegramSecrets, "updatedAt">) {
  const next = await saveSecretsPatch({
    telegram: { ...telegram, updatedAt: new Date().toISOString() },
  });
  return next.telegram!;
}

export async function clearGoogleSecrets() {
  const existing = await getSecrets();
  const { google: _, ...rest } = existing;
  const sb = getSupabase();
  if (sb) {
    if (Object.keys(rest).length === 0) {
      await sb.from("site_config").delete().eq("id", SECRETS_ID);
      memSecrets = {};
    } else {
      await sb.from("site_config").upsert({
        id: SECRETS_ID,
        data: rest,
        updated_at: new Date().toISOString(),
      });
      memSecrets = rest;
    }
  } else {
    memSecrets = rest;
  }
}
