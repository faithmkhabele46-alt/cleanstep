const whatsappNumber = "27691102046";
const emailAddress = "info@cleanstep.co.za";
const storeAddress = "102 Napier Road, Lyttelton, Centurion";

export const cleanstepContact = {
  whatsappNumber,
  whatsappLabel: "069 110 2046",
  whatsappUrl: `https://wa.me/${whatsappNumber}`,
  emailAddress,
  emailUrl: `mailto:${emailAddress}`,
  storeAddress,
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress)}`,
};

export function buildContactEmailUrl({ subject, body }) {
  const params = [];

  if (subject) {
    params.push(`subject=${encodeURIComponent(subject)}`);
  }

  if (body) {
    params.push(`body=${encodeURIComponent(body)}`);
  }

  return `mailto:${emailAddress}${params.length ? `?${params.join("&")}` : ""}`;
}

export function buildContactWhatsAppUrl(message) {
  const text = typeof message === "string" ? message : "";
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
}
