import { NextResponse } from "next/server";
import { clearLoyaltySessionCookie } from "../../../lib/loyalty-auth";

export async function POST() {
  await clearLoyaltySessionCookie();

  return NextResponse.json({
    signedOut: true,
  });
}
