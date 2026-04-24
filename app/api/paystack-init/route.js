import { NextResponse } from "next/server";
import { generateBookingCode } from "../../lib/booking-code";

export async function POST(req) {
  const body = await req.json();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const bookingCode = generateBookingCode();

  if (!body.email || !body.deposit || !body.booking) {
    return NextResponse.json(
      { error: "Email, deposit and booking data are required." },
      { status: 400 },
    );
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: body.email,
      amount: Math.round(body.deposit * 100),
      callback_url: `${siteUrl}/success`,
      reference: `clnpay_${Date.now()}`,
      metadata: {
        bookingCode,
        booking: {
          ...body.booking,
          bookingCode,
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || !data?.data?.authorization_url) {
    return NextResponse.json(
      { error: data?.message || "Payment failed to initialize." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    url: data.data.authorization_url,
  });
}
