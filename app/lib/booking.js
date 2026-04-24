import { services } from "../services/data";

export function formatCurrency(amount) {
  return `R${Number(amount || 0).toLocaleString("en-ZA")}`;
}

export function calculateDeposit(total) {
  return Math.round(total * 0.3);
}

export function encodeBookingSelections(selections = []) {
  return encodeURIComponent(JSON.stringify(selections));
}

export function decodeBookingSelections(data) {
  if (!data) {
    return [];
  }

  try {
    return JSON.parse(decodeURIComponent(data));
  } catch {
    return [];
  }
}

export function getServiceById(serviceId) {
  return Object.values(services).find((service) => service.id === serviceId) || null;
}

export function getServiceCheckoutMode(serviceId) {
  return getServiceById(serviceId)?.checkoutMode || "payment";
}

export function isCarpetCallout(selections = []) {
  const type = getSelectionValue(selections, "type");
  return type === "domestic" || type === "commercial";
}

export function buildEnquiryCopy(serviceId, selections = []) {
  const service = getServiceById(serviceId);
  const category = getSelectionByKey(selections, "category")?.name || "";
  const carpetType = getSelectionByKey(selections, "type")?.name || "";
  const variant =
    getSelectionByKey(selections, "variant")?.name ||
    getSelectionByKey(selections, "package")?.name ||
    getSelectionByKey(selections, "item")?.name ||
    "";
  const quantity = Number(getSelectionValue(selections, "quantity") || 1);
  const customerName = getSelectionByKey(selections, "customerName")?.displayValue || "";
  const customerPhone = getSelectionByKey(selections, "customerPhone")?.displayValue || "";
  const location = getSelectionByKey(selections, "location")?.displayValue || "";
  const bookingDate = getSelectionByKey(selections, "bookingDate")?.displayValue || "";

  if (serviceId === "footwear") {
    const detailText =
      category === "Bags"
        ? variant || "bag"
        : category === "Ordinary Sneakers & Shoes"
          ? variant === "Boots"
            ? "boot"
            : `${variant || "ordinary"} shoe`
          : category === "Suede, Nubuck & Leather"
            ? variant === "Boots"
              ? "suede, nubuck or leather boot"
              : `${variant || "other colour"} leather shoe`
            : variant || "shoe";
    const itemText = quantity > 1 ? `${quantity} ${detailText}s` : `a ${detailText}`;

    return {
      subject: "Cleanstep footwear enquiry",
      body: `Hi Cleanstep,\n\nI would like to enquire about ${itemText}.\n\nThank you.`,
      label: detailText || service?.title || "footwear cleaning",
    };
  }

  if (serviceId === "carpets") {
    if (!isCarpetCallout(selections)) {
      const carpetDetail = [carpetType, variant].filter(Boolean).join(" - ");
      return {
        subject: "Cleanstep carpet enquiry",
        body: `Hi Cleanstep,\n\nI would like to enquire about ${quantity > 1 ? `${quantity} carpets` : "a carpet"}${carpetDetail ? `: ${carpetDetail}` : ""}.\n\nThank you.`,
        label: carpetDetail || service?.title || "carpet cleaning",
      };
    }

    return {
      subject: "Cleanstep carpet booking request",
      body:
        `Hi Cleanstep,\n\n` +
        `My name is ${customerName || "[your name]"}.\n` +
        `I would like to book ${service?.title || "carpet cleaning"} for ${variant || carpetType || "my carpets"}.\n` +
        `Preferred date: ${bookingDate || "[preferred date]"}.\n` +
        `Location: ${location || "[service address]"}.\n` +
        `Phone number: ${customerPhone || "[phone number]"}.\n\n` +
        `Thank you.`,
      label: variant || carpetType || service?.title || "carpet booking",
    };
  }

  if (serviceId === "upholstery") {
    const upholsteryCategory = getSelectionByKey(selections, "category")?.name || "";
    const upholsteryItem =
      upholsteryCategory && variant ? `${variant} ${upholsteryCategory}` : variant || "my item";

    return {
      subject: "Cleanstep upholstery booking request",
      body:
        `Hi Cleanstep,\n\n` +
        `My name is ${customerName || "[your name]"}.\n` +
        `I would like to book you to come and clean ${quantity > 1 ? `${quantity} ${upholsteryItem}s` : upholsteryItem}.\n` +
        `Preferred date: ${bookingDate || "[preferred date]"}.\n` +
        `Location: ${location || "[service address]"}.\n` +
        `Phone number: ${customerPhone || "[phone number]"}.\n\n` +
        `Thank you.`,
      label: upholsteryItem || service?.title || "upholstery booking",
    };
  }

  return {
    subject: `Cleanstep ${service?.title || "service"} enquiry`,
    body: `Hi Cleanstep,\n\nI would like to enquire about ${service?.title || "your service"}.\n\nThank you.`,
    label: variant || service?.title || "service",
  };
}

export function getSelectionValue(selections = [], key) {
  return selections.find((selection) => selection.key === key)?.value;
}

export function getSelectionByKey(selections = [], key) {
  return selections.find((selection) => selection.key === key) || null;
}

export function getSelectionDisplay(selection) {
  if (!selection) {
    return "";
  }

  return (
    selection.displayValue ||
    selection.priceLabel ||
    (typeof selection.price === "number"
      ? formatCurrency(selection.price)
      : selection.pricingType === "quote"
        ? "Quote required"
        : selection.value)
  );
}

function matchesShowWhen(step, selections) {
  if (!step.showWhen) {
    return true;
  }

  return Object.entries(step.showWhen).every(([key, expected]) => {
    const actual = getSelectionValue(selections, key);

    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }

    return actual === expected;
  });
}

export function getVisibleSteps(steps = [], selections = []) {
  return steps.filter((step) => matchesShowWhen(step, selections));
}

export function getStepOptions(step, selections = []) {
  if (!step?.options) {
    return [];
  }

  if (!step.dependsOn || step.dependsOn.length === 0) {
    return step.options;
  }

  return step.options.filter((option) =>
    step.dependsOn.every((dependencyKey) => {
      if (!(dependencyKey in option)) {
        return true;
      }

      return option[dependencyKey] === getSelectionValue(selections, dependencyKey);
    }),
  );
}

function getCommercialRate(area) {
  if (area <= 0) {
    return 0;
  }

  if (area <= 100) {
    return 22;
  }

  if (area <= 400) {
    return 20;
  }

  return 18;
}

export function calculateBookingPricing(serviceId, selections = []) {
  const service = getServiceById(serviceId);

  if (!service) {
    return {
      total: 0,
      deposit: 0,
      remaining: 0,
      lineItems: [],
      notes: [],
      pricePending: false,
    };
  }

  const notes = [];
  const lineItems = [];
  let total = 0;

  if (serviceId === "carpets" && getSelectionValue(selections, "type") === "commercial") {
    const area = Number(getSelectionValue(selections, "area") || 0);
    const rate = getCommercialRate(area);
    total = area * rate;

    if (area > 0) {
      lineItems.push({
        label: "Commercial carpet cleaning",
        detail: `${area} sqm x ${formatCurrency(rate)} / sqm`,
        amount: total,
      });
    }
  } else {
    const pricedSelections = selections.filter((selection) => typeof selection.price === "number");
    const baseSelection =
      pricedSelections.find((selection) => selection.price > 0) ||
      pricedSelections.find((selection) => selection.key !== "quantity");
    const quantity = Number(getSelectionValue(selections, "quantity") || 1);
    const unitPrice = baseSelection?.price || 0;

    if (baseSelection) {
      lineItems.push({
        label: baseSelection.name,
        detail: `${formatCurrency(unitPrice)} x ${quantity}`,
        amount: unitPrice * quantity,
      });
    }

    const paidExtras = selections.filter(
      (selection) =>
        selection.key !== "quantity" &&
        selection.key !== baseSelection?.key &&
        typeof selection.price === "number" &&
        selection.price > 0,
    );

    paidExtras.forEach((extra) => {
      lineItems.push({
        label: extra.name,
        detail: "Optional extra",
        amount: extra.price,
      });
    });

    total =
      unitPrice * quantity +
      paidExtras.reduce((sum, extra) => sum + extra.price, 0);
  }

  const quoteSelections = selections.filter((selection) => selection.pricingType === "quote");

  quoteSelections.forEach((selection) => {
    notes.push(selection.pricingNote || `${selection.name} requires a manual quote.`);
  });

  const informationalNotes = selections
    .map((selection) => selection.pricingNote)
    .filter(Boolean);

  informationalNotes.forEach((note) => {
    if (!notes.includes(note)) {
      notes.push(note);
    }
  });

  const deposit = calculateDeposit(total);

  return {
    total,
    deposit,
    remaining: total - deposit,
    lineItems,
    notes,
    pricePending: quoteSelections.length > 0,
  };
}

export function buildBookingSnapshot(serviceId, selections = []) {
  const service = getServiceById(serviceId);
  const pricing = calculateBookingPricing(serviceId, selections);
  const customerName =
    getSelectionByKey(selections, "customerName")?.displayValue ||
    getSelectionByKey(selections, "customerName")?.value ||
    "";
  const customerEmail =
    getSelectionByKey(selections, "customerEmail")?.displayValue ||
    getSelectionByKey(selections, "customerEmail")?.value ||
    "";
  const customerPhone =
    getSelectionByKey(selections, "customerPhone")?.displayValue ||
    getSelectionByKey(selections, "customerPhone")?.value ||
    "";
  const location =
    getSelectionByKey(selections, "location")?.displayValue ||
    getSelectionByKey(selections, "location")?.value ||
    "";
  const bookingDate =
    getSelectionByKey(selections, "bookingDate")?.displayValue ||
    getSelectionByKey(selections, "bookingDate")?.value ||
    "";
  const bookingTime =
    getSelectionByKey(selections, "bookingTime")?.displayValue ||
    getSelectionByKey(selections, "bookingTime")?.value ||
    "";
  const primaryItem =
    pricing.lineItems[0]?.label ||
    selections.find((selection) => typeof selection.price === "number")?.name ||
    selections[0]?.name ||
    "";

  return {
    serviceId,
    serviceTitle: service?.title || "",
    primaryItem,
    customerName,
    customerEmail,
    customerPhone,
    location,
    bookingDate,
    bookingTime,
    total: pricing.total,
    deposit: pricing.deposit,
    selections,
    lineItems: pricing.lineItems,
    notes: pricing.notes,
  };
}
