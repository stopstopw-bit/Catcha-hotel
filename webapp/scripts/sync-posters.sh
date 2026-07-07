#!/usr/bin/env bash
# คัดลอกโปสเตอร์จากโฟลเดอร์ uploads/ ไปยัง webapp/public/catalog/
# วางไฟล์ใหม่ใน uploads/ ตามชื่อด้านล่าง แล้วรัน: bash webapp/scripts/sync-posters.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
UPLOADS="${ROOT}/uploads"
PUBLIC="${ROOT}/webapp/public"

declare -A MAP=(
  ["cozy-duo.jpg"]="catalog/rooms/cozy-duo.jpg"
  ["mini-duo.jpg"]="catalog/rooms/mini-duo.jpg"
  ["cat-tower.jpg"]="catalog/rooms/cat-tower.jpg"
  ["catflix.jpg"]="catalog/rooms/catflix.jpg"
  ["mid-cozy.jpg"]="catalog/rooms/mid-cozy.jpg"
  ["mini-meow.jpg"]="catalog/rooms/mini-meow.jpg"
  ["transport.jpg"]="catalog/services/transport.jpg"
)

mkdir -p "${UPLOADS}" "${PUBLIC}/catalog/rooms" "${PUBLIC}/catalog/services"

updated=0
missing=0

for src in "${!MAP[@]}"; do
  from="${UPLOADS}/${src}"
  to="${PUBLIC}/${MAP[$src]}"
  if [[ -f "$from" ]]; then
    cp "$from" "$to"
    echo "✓ ${src} → ${MAP[$src]}"
    updated=$((updated + 1))
  else
    echo "– ข้าม (ยังไม่มี): uploads/${src}"
    missing=$((missing + 1))
  fi
done

echo ""
echo "อัปเดต ${updated} ไฟล์ · ยังขาด ${missing} ไฟล์ใน uploads/"
