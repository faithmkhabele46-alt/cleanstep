export async function sendBookingConfirmationEmail({
  to,
  bookingCode,
  serviceTitle,
  primaryItem,
  total,
  deposit,
  location,
  bookingDate,
  bookingTime,
  followUpMessage = "",
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOOKINGS_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      sent: false,
      reason:
        "Confirmation email provider is not configured. Add RESEND_API_KEY and BOOKINGS_FROM_EMAIL.",
    };
  }

  const lines = [
    `Your Cleanstep booking has been confirmed.`,
    ``,
    `Booking code: ${bookingCode}`,
    `Service: ${serviceTitle}`,
    `Item: ${primaryItem || "Selected service"}`,
    `Total: R${Number(total || 0).toLocaleString("en-ZA")}`,
  ];

  if (Number(deposit || 0) > 0) {
    lines.push(`Deposit paid: R${Number(deposit || 0).toLocaleString("en-ZA")}`);
  } else {
    lines.push(`Deposit paid: No online deposit was required for this booking.`);
  }

  if (location) {
    lines.push(`Location: ${location}`);
  }

  if (bookingDate) {
    lines.push(`Preferred date: ${bookingDate}`);
  }

  if (bookingTime) {
    lines.push(`Preferred time: ${bookingTime}`);
  }

  if (followUpMessage) {
    lines.push("", followUpMessage);
  }

  lines.push("", "Thank you for booking with Cleanstep.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Cleanstep booking confirmed - ${bookingCode}`,
      text: lines.join("\n"),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      sent: false,
      reason: message || "Unable to send confirmation email.",
    };
  }

  return { sent: true, reason: "" };
}
