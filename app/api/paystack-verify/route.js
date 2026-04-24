import { NextResponse } from "next/server";
import { generateBookingCode } from "../../lib/booking-code";
import { sendBookingConfirmationEmail } from "../../lib/email";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import { saveBookingRecord } from "../../lib/server-bookings";

export async function POST(req) {
  const { reference } = await req.json();

  if (!reference) {
    return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json();
  const transaction = payload?.data;

  if (!response.ok || !transaction) {
    return NextResponse.json(
      { error: payload?.message || "Unable to verify payment." },
      { status: 400 },
    );
  }

  if (transaction.status !== "success") {
    return NextResponse.json(
      { error: `Payment is not successful yet. Current status: ${transaction.status}` },
      { status: 400 },
    );
  }

  const metadata = transaction.metadata || {};
  const booking = metadata.booking || {};

  if (!booking.serviceId || !booking.customerEmail) {
    return NextResponse.json(
      { error: "Payment metadata is incomplete. Booking details are missing." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  let savedBooking = null;
  let bookingCode = booking.bookingCode || generateBookingCode();
  let alreadySaved = false;

  if (supabase) {
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select(
        "id, booking_code, service_title, primary_item, location, booking_date, booking_time, total, deposit, customer_email, status",
      )
      .eq("payment_reference", reference)
      .maybeSingle();

    if (existingBooking) {
      savedBooking = existingBooking;
      bookingCode = existingBooking.booking_code;
      alreadySaved = true;
    } else {
      const insertResult = await saveBookingRecord({
        booking,
        status: "paid",
        paymentReference: reference,
        paymentStatus: transaction.status,
        authUserId: metadata.authUserId || null,
      });

      if (insertResult.error) {
        return NextResponse.json(
          { error: insertResult.error || "Unable to save booking after payment." },
          { status: 500 },
        );
      }

      savedBooking = insertResult.savedBooking;
      bookingCode = insertResult.bookingCode;
    }
  }

  const emailResult = alreadySaved
    ? { sent: false, reason: "Confirmation email was already handled for this booking." }
    : await sendBookingConfirmationEmail({
        to: booking.customerEmail,
        bookingCode,
        serviceTitle: booking.serviceTitle,
        primaryItem: booking.primaryItem,
        total: booking.total,
        deposit: booking.deposit,
        location: booking.location,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
      });

  return NextResponse.json({
    verified: true,
    booking: {
      booking_code: bookingCode,
      service_title: savedBooking?.service_title || booking.serviceTitle,
      primary_item: savedBooking?.primary_item || booking.primaryItem,
      location: savedBooking?.location || booking.location,
      booking_date: savedBooking?.booking_date || booking.bookingDate,
      booking_time: savedBooking?.booking_time || booking.bookingTime,
      total: savedBooking?.total || booking.total,
      deposit: savedBooking?.deposit || booking.deposit,
      customer_email: savedBooking?.customer_email || booking.customerEmail,
      status: savedBooking?.status || "paid",
    },
    email: emailResult,
    savedToDatabase: Boolean(savedBooking),
  });
}
