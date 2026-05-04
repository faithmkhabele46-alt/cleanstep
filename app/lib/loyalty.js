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

export function getLoyaltyVisitPoints(quantity = 0) {
  const safeQuantity = Number.isFinite(Number(quantity)) ? Number(quantity) : 0;

  if (safeQuantity < LOYALTY_MIN_QUALIFYING_ITEMS) {
    return 0;
  }

  return safeQuantity / 2;
}

export function formatLoyaltyPoints(points = 0) {
  const safePoints = Number.isFinite(Number(points)) ? Number(points) : 0;

  if (Number.isInteger(safePoints)) {
    return String(safePoints);
  }

  return safePoints.toFixed(1).replace(/\.0$/, "");
}

export function getLoyaltyProgress(totalPoints = 0, totalVisits = 0) {
  const safePoints = Number.isFinite(totalPoints)
    ? Math.max(0, Number(totalPoints))
    : 0;
  const safeTotalVisits = Number.isFinite(totalVisits) ? Math.max(0, totalVisits) : 0;
  const pointsIntoCurrentReward = safePoints % LOYALTY_REWARD_TARGET;
  const rewardUnlocked =
    safePoints >= LOYALTY_REWARD_TARGET && pointsIntoCurrentReward === 0;
  const pointsLeft = rewardUnlocked
    ? 0
    : Math.max(0, LOYALTY_REWARD_TARGET - pointsIntoCurrentReward);
  const currentCyclePoints = rewardUnlocked ? LOYALTY_REWARD_TARGET : pointsIntoCurrentReward;

  return {
    totalVisits: safeTotalVisits,
    totalPoints: safePoints,
    rewardTarget: LOYALTY_REWARD_TARGET,
    minimumQualifyingItems: LOYALTY_MIN_QUALIFYING_ITEMS,
    completedRewards: Math.floor(safePoints / LOYALTY_REWARD_TARGET),
    pointsIntoCurrentReward: currentCyclePoints,
    pointsLeft,
    rewardUnlocked,
    progressPercentage: Math.round((currentCyclePoints / LOYALTY_REWARD_TARGET) * 100),
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
  totalPoints = 0,
} = {}) {
  const progress = getLoyaltyProgress(totalPoints, totalVisits);
  const link = buildLoyaltyDashboardUrl(whatsAppNumber);
  const greeting = customerName ? `Hi ${customerName},` : "Hi,";

  return [
    greeting,
    "",
    "Your Cleanstep loyalty visit has been recorded.",
    `You have ${progress.totalVisits} recorded visit${progress.totalVisits === 1 ? "" : "s"} and ${formatLoyaltyPoints(progress.totalPoints)} loyalty point${progress.totalPoints === 1 ? "" : "s"}.`,
    `Cleanstep gives 1 point for every 2 shoes in the same drop-off. 3 shoes = 1.5 points, 4 shoes = 2 points, and 5 shoes = 2.5 points.`,
    progress.pointsLeft > 0
      ? `You need ${formatLoyaltyPoints(progress.pointsLeft)} more point${progress.pointsLeft === 1 ? "" : "s"} to reach your free wash.`
      : "You have reached your free wash reward.",
    "",
    "Use this link to register or sign in with your WhatsApp number and password:",
    link,
  ].join("\n");
}
