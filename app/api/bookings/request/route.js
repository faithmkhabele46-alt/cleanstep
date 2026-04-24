import { NextResponse } from "next/server";
import { sendBookingConfirmationEmail } from "../../../lib/email";
import { saveBookingRecord } from "../../../lib/server-bookings";

export async function POST(req) {
  const { booking } = await req.json();

  if (!booking?.serviceId || !booking?.customerEmail) {
    return NextResponse.json(
      { error: "Booking details are incomplete. Customer email is required." },
      { status: 400 },
    );
  }

  const { savedBooking, bookingCode, error } = await saveBookingRecord({
    booking,
    status: "pending-contact",
    paymentStatus: "not-required",
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const emailResult = await sendBookingConfirmationEmail({
    to: booking.customerEmail,
    bookingCode,
    serviceTitle: booking.serviceTitle,
    primaryItem: booking.primaryItem,
    total: booking.total,
    deposit: 0,
    location: booking.location,
    bookingDate: booking.bookingDate,
    bookingTime: "",
    followUpMessage:
      "We have received your booking request and the Cleanstep team will contact you to confirm the remaining details.",
  });

  return NextResponse.json({
    booking: {
      booking_code: bookingCode,
      service_title: savedBooking?.service_title || booking.serviceTitle,
      primary_item: savedBooking?.primary_item || booking.primaryItem,
      location: savedBooking?.location || booking.location,
      booking_date: savedBooking?.booking_date || booking.bookingDate,
      booking_time: savedBooking?.booking_time || booking.bookingTime,
      total: savedBooking?.total || booking.total,
      deposit: 0,
      customer_email: savedBooking?.customer_email || booking.customerEmail,
      status: savedBooking?.status || "pending-contact",
    },
    email: emailResult,
    savedToDatabase: Boolean(savedBooking),
  });
}
