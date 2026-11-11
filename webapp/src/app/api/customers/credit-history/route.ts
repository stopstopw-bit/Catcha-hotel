import { NextRequest, NextResponse } from "next/server";
import { findCustomerByLine, getMemberCreditLedger } from "@/lib/customers-store";
import { resolveCustomerLineId, noCustomerSessionResponse } from "@/lib/customer-session";
import { getSiteConfig } from "@/lib/config-store";
import { isFeatureOn } from "@/lib/features";

/** ลูกค้าเปิดดูประวัติเครดิต Member ของตัวเอง — เติมเมื่อไร ตัดไปกับอะไร คงเหลือเท่าไร */
export async function GET(req: NextRequest) {
  const lineUserId = await resolveCustomerLineId(req, req.nextUrl.searchParams.get("lineUserId"));
  if (!lineUserId) return noCustomerSessionResponse();
  if (!isFeatureOn(await getSiteConfig(), "memberCredit")) {
    return NextResponse.json({ entries: [], balance: 0 });
  }
  const customer = await findCustomerByLine(lineUserId);
  if (!customer) return NextResponse.json({ entries: [], balance: 0 });
  const balance = customer.memberCredit || 0;
  const entries = await getMemberCreditLedger(customer.id, balance);
  return NextResponse.json({ entries, balance });
}
