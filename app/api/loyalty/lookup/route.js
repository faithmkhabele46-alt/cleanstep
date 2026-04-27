import { NextResponse } from "next/server";
import { getLoyaltyDashboardData } from "../../../lib/loyalty-server";

export async function POST(request) {
  try {
    const body = await request.json();
    const data = await getLoyaltyDashboardData(body.whatsAppNumber);

    return NextResponse.json(data, { status: data.found ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      {
        found: false,
        message: error.message || "Unable to look up loyalty visits.",
      },
      { status: 500 },
    );
  }
}
