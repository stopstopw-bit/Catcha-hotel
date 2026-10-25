import { BUSINESS } from "./business";
import { getSiteConfig } from "./config-store";
import { bookingConfirmUrl as buildConfirmUrl, bookingTransportUrl } from "./line-config";
import { hasTransport, type BookingTransport } from "./transport";
import { getLineCredentials } from "./line-config";
import { buildAppointmentConfirmFlex } from "./line";
import { groomProgramName, resolveGroomPrograms } from "./grooming-prices";
import { roomName } from "./booking-reminders";

export async function bookingConfirmUrl(bookingId: string) {
  const creds = await getLineCredentials();
  return buildConfirmUrl(bookingId, creds?.liffId);
}

export async function buildBookingConfirmFlex(
  booking: {
    id: string;
    catName: string;
    customerName: string;
    service: string;
    date?: string;
    time?: string;
    checkin?: string;
    checkout?: string;
    room?: string;
    notes?: string;
    groomProgram?: string;
    transport?: BookingTransport;
  },
  /** น้องทุกตัวในบ้านที่จองมาด้วยกัน (นัดละตัว) — อาบคนละโปรแกรม จะแยกบอกรายตัวในการ์ด */
  pets?: { catName: string; groomProgram?: string }[]
) {
  const config = await getSiteConfig();
  const location =
    config.business.location.th || BUSINESS.location.th;
  const mapsUrl = config.business.maps || BUSINESS.maps;

  // ชื่อโปรแกรมจากตั้งค่าร้าน (รวมโปรแกรมที่ร้านเพิ่มเอง) · หลายตัวคนละโปรแกรม → บอกรายตัว
  const programs = resolveGroomPrograms(config.groomPricePrograms);
  const group = booking.service === "groom" && pets && pets.length > 1 ? pets : [];
  const mixed = new Set(group.map((x) => x.groomProgram || "")).size > 1;
  const programText = mixed
    ? group
        .map((x) => `${x.catName} · ${groomProgramName(x.groomProgram, programs) || "ยังไม่ระบุ"}`)
        .join("\n")
    : groomProgramName(group[0]?.groomProgram ?? booking.groomProgram, programs) || undefined;

  const creds = await getLineCredentials();
  return buildAppointmentConfirmFlex({
    ...booking,
    room: booking.room ? roomName(booking.room, config) : undefined,
    programText,
    confirmUrl: await bookingConfirmUrl(booking.id),
    transportUrl: hasTransport(booking.transport)
      ? bookingTransportUrl(booking.id, creds?.liffId)
      : undefined,
    mapsUrl,
    location: [config.business.name, location].filter(Boolean).join(" · "),
    businessName: config.business.name,
  }, config.cards?.bookingConfirm);
}
