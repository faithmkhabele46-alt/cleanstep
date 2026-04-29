import {
  buildBookingSnapshot,
  calculateBookingPricing,
  formatCurrency,
  getServiceById,
  isCarpetCallout,
} from "./booking";

const BOOKING_BASKET_KEY = "cleanstep_booking_basket";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getStoredBookingBasket() {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(BOOKING_BASKET_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredBookingBasket(items = []) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(BOOKING_BASKET_KEY, JSON.stringify(items));
}

export function clearStoredBookingBasket() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(BOOKING_BASKET_KEY);
}

export function createBasketEntry(serviceId, selections = []) {
  const service = getServiceById(serviceId);
  const snapshot = buildBookingSnapshot(serviceId, selections);
  const pricing = calculateBookingPricing(serviceId, selections);

  return {
    id: `${serviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serviceId,
    serviceTitle: service?.title || "",
    selections,
    snapshot,
    pricing,
    createdAt: new Date().toISOString(),
  };
}

export function calculateBasketPricing(entries = []) {
  const lineItems = [];
  const notes = [];
  let total = 0;
  let deposit = 0;
  let remaining = 0;

  entries.forEach((entry) => {
    const servicePricing =
      entry?.pricing || calculateBookingPricing(entry.serviceId, entry.selections || []);

    lineItems.push(
      ...servicePricing.lineItems.map((item) => ({
        ...item,
        serviceId: entry.serviceId,
        serviceTitle: entry.serviceTitle || getServiceById(entry.serviceId)?.title || "",
      })),
    );

    servicePricing.notes.forEach((note) => {
      if (!notes.includes(note)) {
        notes.push(note);
      }
    });

    total += servicePricing.total;
    deposit += servicePricing.deposit;
    remaining += servicePricing.remaining;
  });

  return {
    total,
    deposit,
    remaining,
    lineItems,
    notes,
  };
}

export function getBasketPrimaryLabel(entry) {
  return (
    entry?.snapshot?.primaryItem ||
    entry?.pricing?.lineItems?.[0]?.label ||
    entry?.selections?.find((selection) => typeof selection.price === "number")?.name ||
    entry?.serviceTitle ||
    "Booking item"
  );
}

export function buildBasketContactCopy(entries = []) {
  const normalizedEntries = entries.filter(Boolean);
  const hasCalloutItem = normalizedEntries.some((entry) => {
    if (entry.serviceId === "upholstery") {
      return true;
    }

    if (entry.serviceId === "carpets") {
      return isCarpetCallout(entry.selections || []);
    }

    return false;
  });
  const allDropOffItems = normalizedEntries.every((entry) => {
    if (entry.serviceId === "footwear") {
      return true;
    }

    return entry.serviceId === "carpets" && !isCarpetCallout(entry.selections || []);
  });
  const lines = normalizedEntries.map((entry, index) => {
    const snapshot = entry.snapshot || buildBookingSnapshot(entry.serviceId, entry.selections || []);
    const label = getBasketPrimaryLabel(entry);
    const parts = [`${index + 1}. ${entry.serviceTitle}: ${label}`];

    if (snapshot.total > 0) {
      parts.push(`(${formatCurrency(snapshot.total)})`);
    }

    return parts.join(" ");
  });

  if (allDropOffItems) {
    return {
      subject: "Cleanstep booking enquiry",
      body: `Hi Cleanstep,\n\nI would like to enquire about the following items:\n${lines.join("\n")}\n\nThank you.`,
      allDropOffItems: true,
      hasCalloutItem: false,
    };
  }

  if (hasCalloutItem) {
    const firstCallout = normalizedEntries.find((entry) => {
      if (entry.serviceId === "upholstery") {
        return true;
      }

      return entry.serviceId === "carpets" && isCarpetCallout(entry.selections || []);
    });
    const snapshot =
      firstCallout?.snapshot ||
      (firstCallout ? buildBookingSnapshot(firstCallout.serviceId, firstCallout.selections || []) : {});

    return {
      subject: "Cleanstep booking request",
      body:
        `Hi Cleanstep,\n\n` +
        `My name is ${snapshot.customerName || "[your name]"}.\n` +
        `I would like to book you for the following items:\n${lines.join("\n")}\n` +
        `Preferred date: ${snapshot.bookingDate || "[preferred date]"}.\n` +
        `Location: ${snapshot.location || "[service address]"}.\n` +
        `Phone number: ${snapshot.customerPhone || "[phone number]"}.\n\n` +
        `Thank you.`,
      allDropOffItems: false,
      hasCalloutItem: true,
    };
  }

  return {
    subject: "Cleanstep booking enquiry",
    body: `Hi Cleanstep,\n\nI would like to enquire about the following items:\n${lines.join("\n")}\n\nThank you.`,
    allDropOffItems: false,
    hasCalloutItem: false,
  };
}
