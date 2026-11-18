"use client";

import { useCallback, useEffect, useState } from "react";
import { useL } from "@/components/LocaleProvider";

/** โหลดครั้งเดียวต่อการเปิดหน้า แล้วใช้ร่วมกันทุกส่วน */
let loading: Promise<Record<string, string>> | null = null;

function loadCatalogEn() {
  if (!loading) {
    loading = fetch("/api/i18n/catalog")
      .then((r) => r.json())
      .then((d) => (d?.map && typeof d.map === "object" ? (d.map as Record<string, string>) : {}))
      .catch(() => {
        loading = null;
        return {};
      });
  }
  return loading;
}

/**
 * ชื่อโปร/คอร์ส/แพ็กเกจที่ร้านพิมพ์เป็นไทย → ภาษาอังกฤษ (ลูกค้าที่เลือก English)
 * ใช้: const T = useCatalogEn(); T(offer.name) — ไม่มีคำแปล/ภาษาไทย = คืนข้อความเดิม
 */
export function useCatalogEn() {
  const { en } = useL();
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!en) return;
    let alive = true;
    loadCatalogEn().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, [en]);
  return useCallback(
    (s: string | undefined | null): string => {
      const v = s || "";
      if (!en || !v) return v;
      return map[v.trim()] ?? v;
    },
    [en, map]
  );
}
