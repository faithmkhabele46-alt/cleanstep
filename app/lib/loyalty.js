export const LOYALTY_REWARD_TARGET = 10;

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

export function getLoyaltyProgress(totalVisits = 0) {
  const safeVisits = Number.isFinite(totalVisits) ? Math.max(0, totalVisits) : 0;
  const visitsIntoCurrentReward = safeVisits % LOYALTY_REWARD_TARGET;
  const visitsLeft =
    visitsIntoCurrentReward === 0 && safeVisits > 0
      ? LOYALTY_REWARD_TARGET
      : LOYALTY_REWARD_TARGET - visitsIntoCurrentReward;

  return {
    totalVisits: safeVisits,
    rewardTarget: LOYALTY_REWARD_TARGET,
    completedRewards: Math.floor(safeVisits / LOYALTY_REWARD_TARGET),
    visitsIntoCurrentReward,
    visitsLeft,
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
} = {}) {
  const progress = getLoyaltyProgress(totalVisits);
  const link = buildLoyaltyDashboardUrl(whatsAppNumber);
  const greeting = customerName ? `Hi ${customerName},` : "Hi,";

  return [
    greeting,
    "",
    "Your Cleanstep loyalty visit has been recorded.",
    `You have ${progress.totalVisits} recorded visit${progress.totalVisits === 1 ? "" : "s"}.`,
    `You need ${progress.visitsLeft} more visit${progress.visitsLeft === 1 ? "" : "s"} to reach your next reward.`,
    "",
    "Use this link to register or sign in with your WhatsApp number and password:",
    link,
  ].join("\n");
}
