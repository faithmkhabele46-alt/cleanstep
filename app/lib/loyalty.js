export const LOYALTY_REWARD_TARGET = 5;
export const LOYALTY_MIN_QUALIFYING_ITEMS = 2;

export function normalizeWhatsAppNumber(value = "") {
  const digits = String(value).replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("27")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `27${digits.slice(1)}`;
  }

  return digits;
}

export function formatWhatsAppNumber(value = "") {
  const normalized = normalizeWhatsAppNumber(value);

  if (normalized.startsWith("27") && normalized.length >= 11) {
    const local = `0${normalized.slice(2)}`;
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 10)}`.trim();
  }

  return value || "";
}

export function isQualifyingLoyaltyVisit(quantity = 0) {
  return Number(quantity) >= LOYALTY_MIN_QUALIFYING_ITEMS;
}

export function getLoyaltyProgress(totalQualifyingVisits = 0, totalVisits = totalQualifyingVisits) {
  const safeQualifyingVisits = Number.isFinite(totalQualifyingVisits)
    ? Math.max(0, totalQualifyingVisits)
    : 0;
  const safeTotalVisits = Number.isFinite(totalVisits) ? Math.max(0, totalVisits) : safeQualifyingVisits;
  const visitsIntoCurrentReward = safeQualifyingVisits % LOYALTY_REWARD_TARGET;
  const visitsLeft =
    visitsIntoCurrentReward === 0 && safeQualifyingVisits > 0
      ? LOYALTY_REWARD_TARGET
      : LOYALTY_REWARD_TARGET - visitsIntoCurrentReward;

  return {
    totalVisits: safeTotalVisits,
    qualifyingVisits: safeQualifyingVisits,
    rewardTarget: LOYALTY_REWARD_TARGET,
    minimumQualifyingItems: LOYALTY_MIN_QUALIFYING_ITEMS,
    completedRewards: Math.floor(safeQualifyingVisits / LOYALTY_REWARD_TARGET),
    visitsIntoCurrentReward,
    visitsLeft,
    progressPercentage: Math.round((visitsIntoCurrentReward / LOYALTY_REWARD_TARGET) * 100),
  };
}

export function getLoyaltySiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function buildLoyaltyDashboardUrl(whatsAppNumber = "") {
  const siteUrl = getLoyaltySiteUrl();
  const normalized = normalizeWhatsAppNumber(whatsAppNumber);

  return `${siteUrl}/loyalty${normalized ? `?phone=${encodeURIComponent(normalized)}` : ""}`;
}

export function buildLoyaltyShareMessage({
  customerName = "",
  whatsAppNumber = "",
  totalVisits = 0,
  qualifyingVisits = totalVisits,
} = {}) {
  const progress = getLoyaltyProgress(qualifyingVisits, totalVisits);
  const link = buildLoyaltyDashboardUrl(whatsAppNumber);
  const greeting = customerName ? `Hi ${customerName},` : "Hi,";

  return [
    greeting,
    "",
    "Your Cleanstep loyalty visit has been recorded.",
    `You have ${progress.totalVisits} recorded visit${progress.totalVisits === 1 ? "" : "s"}, and ${progress.qualifyingVisits} qualifying visit${progress.qualifyingVisits === 1 ? "" : "s"} count toward your reward.`,
    `A visit qualifies when you bring in ${progress.minimumQualifyingItems} or more shoes.`,
    `You need ${progress.visitsLeft} more qualifying visit${progress.visitsLeft === 1 ? "" : "s"} to reach your free wash.`,
    "",
    "Use this link to register or sign in with your WhatsApp number and password:",
    link,
  ].join("\n");
}
