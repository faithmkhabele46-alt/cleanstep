export const DAILY_FINANCE_PRODUCTS = [
  {
    code: "bw_copies",
    name: "Black & White Copies",
    shortName: "B/W Copies",
    category: "Copies",
    basePrice: 4,
    bulkThreshold: 10,
    bulkPrice: 2,
  },
  {
    code: "colour_copies",
    name: "Colour Copies",
    shortName: "Colour Copies",
    category: "Copies",
    basePrice: 8,
    bulkThreshold: 10,
    bulkPrice: 5,
  },
  {
    code: "bw_printouts",
    name: "Black & White Printouts",
    shortName: "B/W Printouts",
    category: "Printouts",
    basePrice: 5,
    bulkThreshold: 10,
    bulkPrice: 3,
  },
  {
    code: "colour_printouts",
    name: "Colour Printouts",
    shortName: "Colour Printouts",
    category: "Printouts",
    basePrice: 8,
  },
  {
    code: "envelopes",
    name: "Envelopes",
    shortName: "Envelopes",
    category: "Shop items",
    basePrice: 10,
  },
  {
    code: "cv",
    name: "CV",
    shortName: "CV",
    category: "Services",
    basePrice: 30,
  },
  {
    code: "others",
    name: "Others",
    shortName: "Others",
    category: "Custom",
    basePrice: 0,
    allowsCustomAmount: true,
  },
  {
    code: "water",
    name: "Water",
    shortName: "Water",
    category: "Shop items",
    basePrice: 15,
  },
  {
    code: "pens",
    name: "Pens",
    shortName: "Pens",
    category: "Shop items",
    basePrice: 10,
  },
  {
    code: "tissues",
    name: "Tissues",
    shortName: "Tissues",
    category: "Shop items",
    basePrice: 10,
  },
];

export const DAILY_FINANCE_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

export function getDailyFinanceProduct(productCode = "") {
  return DAILY_FINANCE_PRODUCTS.find((item) => item.code === productCode) || null;
}

export function getJohannesburgDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function addDaysToDateString(dateString = "", dayOffset = 0) {
  if (!dateString) {
    return getJohannesburgDateString();
  }

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) {
    return getJohannesburgDateString();
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + dayOffset);

  return utcDate.toISOString().slice(0, 10);
}

export function calculateDailyFinancePricing(productCode = "", quantity = 1, customAmount = 0) {
  const product = getDailyFinanceProduct(productCode);
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const safeCustomAmount = Math.max(0, Number(customAmount) || 0);

  if (!product) {
    return {
      product: null,
      quantity: safeQuantity,
      unitPrice: 0,
      total: 0,
      isBulkPrice: false,
    };
  }

  if (product.allowsCustomAmount) {
    return {
      product,
      quantity: safeQuantity,
      unitPrice: safeCustomAmount,
      total: safeCustomAmount * safeQuantity,
      isBulkPrice: false,
    };
  }

  const isBulkPrice =
    Number.isFinite(product.bulkThreshold) &&
    safeQuantity >= product.bulkThreshold &&
    Number.isFinite(product.bulkPrice);
  const unitPrice = isBulkPrice ? product.bulkPrice : product.basePrice;

  return {
    product,
    quantity: safeQuantity,
    unitPrice,
    total: unitPrice * safeQuantity,
    isBulkPrice,
  };
}

export function summarizeDailyFinanceSales(items = []) {
  const summary = {
    totalSales: 0,
    cashTotal: 0,
    cardTotal: 0,
    totalUnits: 0,
    productTotals: {},
  };

  items.forEach((item) => {
    const total = Number(item.total || 0);
    const quantity = Number(item.quantity || 0);
    const code = item.productCode || "";
    const summaryKey = `${code}:${item.productName || code}`;

    summary.totalSales += total;
    summary.totalUnits += quantity;

    if (item.paymentMethod === "cash") {
      summary.cashTotal += total;
    }

    if (item.paymentMethod === "card") {
      summary.cardTotal += total;
    }

    if (!summary.productTotals[summaryKey]) {
      summary.productTotals[summaryKey] = {
        productCode: code,
        productName: item.productName || code,
        quantity: 0,
        total: 0,
      };
    }

    summary.productTotals[summaryKey].quantity += quantity;
    summary.productTotals[summaryKey].total += total;
  });

  return {
    ...summary,
    productTotals: Object.values(summary.productTotals).sort((a, b) =>
      a.productName.localeCompare(b.productName),
    ),
  };
}

export function summarizeDailyFinanceHistory(items = []) {
  const byDate = new Map();
  const countedTransactions = new Set();

  items.forEach((item) => {
    const saleDate = item.saleDate || "";
    const total = Number(item.total || 0);
    const quantity = Number(item.quantity || 0);
    const transactionKey = item.transactionGroupId || item.id;

    if (!saleDate) {
      return;
    }

    if (!byDate.has(saleDate)) {
      byDate.set(saleDate, {
        saleDate,
        totalSales: 0,
        cashTotal: 0,
        cardTotal: 0,
        totalUnits: 0,
        totalTransactions: 0,
      });
    }

    const current = byDate.get(saleDate);
    current.totalSales += total;
    current.totalUnits += quantity;
    if (transactionKey && !countedTransactions.has(`${saleDate}:${transactionKey}`)) {
      current.totalTransactions += 1;
      countedTransactions.add(`${saleDate}:${transactionKey}`);
    }

    if (item.paymentMethod === "cash") {
      current.cashTotal += total;
    }

    if (item.paymentMethod === "card") {
      current.cardTotal += total;
    }
  });

  return Array.from(byDate.values()).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
}
