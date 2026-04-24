import { generateBookingCode } from "./booking-code";
import { createServerSupabaseClient } from "./supabase-server";

export async function saveBookingRecord({
  booking,
  status,
  paymentReference = null,
  paymentStatus = null,
  authUserId = null,
}) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      savedBooking: null,
      bookingCode: generateBookingCode(),
      error:
        "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  let savedBooking = null;
  let insertError = null;
  let bookingCode = generateBookingCode();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidateCode = attempt === 0 ? bookingCode : generateBookingCode();
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        booking_code: candidateCode,
        service_id: booking.serviceId,
        service_title: booking.serviceTitle,
        primary_item: booking.primaryItem,
        customer_name: booking.customerName || null,
        customer_email: booking.customerEmail || null,
        customer_phone: booking.customerPhone || null,
        location: booking.location || null,
        booking_date: booking.bookingDate || null,
        booking_time: booking.bookingTime || null,
        total: booking.total,
        deposit: booking.deposit || 0,
        selections: booking.selections || [],
        status,
        payment_reference: paymentReference,
        payment_status: paymentStatus,
        auth_user_id: authUserId,
      })
      .select(
        "id, booking_code, service_title, primary_item, location, booking_date, booking_time, total, deposit, customer_email, status",
      )
      .single();

    if (!error) {
      savedBooking = data;
      bookingCode = candidateCode;
      break;
    }

    insertError = error;
  }

  return {
    savedBooking,
    bookingCode,
    error: savedBooking ? "" : insertError?.message || "Unable to save booking.",
  };
}
