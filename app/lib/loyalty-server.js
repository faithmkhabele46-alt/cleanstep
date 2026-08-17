import { createServerSupabaseClient } from "./supabase-server";
import {
  formatWhatsAppNumber,
  LOYALTY_REWARD_TARGET,
  getLoyaltyVisitPoints,
  getLoyaltyProgress,
  isQualifyingLoyaltyVisit,
  normalizeWhatsAppNumber,
} from "./loyalty";

function isMissingRewardClaimsTable(error) {
  return (
    error?.code === "42P01" ||
    error?.message?.toLowerCase().includes("loyalty_reward_claims")
  );
}

async function loadRewardClaims(supabase, customerId) {
  const { data, error } = await supabase
    .from("loyalty_reward_claims")
    .select("id, claimed_at, points_claimed, notes, created_at")
    .eq("customer_id", customerId)
    .order("claimed_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRewardClaimsTable(error)) {
      return [];
    }

    throw error;
  }

  return (data || []).map((claim) => ({
    id: claim.id,
    claimedAt: claim.claimed_at,
    pointsClaimed: Number(claim.points_claimed || LOYALTY_REWARD_TARGET),
    notes: claim.notes,
    createdAt: claim.created_at,
  }));
}

export async function getLoyaltyDashboardData(rawWhatsAppNumber = "") {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      found: false,
      message:
        "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty lookups.",
      customer: null,
      progress: null,
      visits: [],
    };
  }

  const whatsAppNumber = normalizeWhatsAppNumber(rawWhatsAppNumber);

  if (!whatsAppNumber) {
    return {
      found: false,
      message: "Enter the WhatsApp number used at Cleanstep.",
      customer: null,
      progress: null,
      visits: [],
    };
  }

  const { data: customer, error: customerError } = await supabase
    .from("loyalty_customers")
    .select("id, customer_name, whatsapp_number, created_at")
    .eq("whatsapp_number", whatsAppNumber)
    .maybeSingle();

  if (customerError) {
    throw customerError;
  }

  if (!customer) {
    return {
      found: false,
      message: "No loyalty profile was found for that WhatsApp number yet.",
      customer: null,
      progress: null,
      visits: [],
    };
  }

  const { data: visits, error: visitsError } = await supabase
    .from("loyalty_visits")
    .select("id, shoe_type, visit_date, receipt_number, notes, quantity, created_at")
    .eq("customer_id", customer.id)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (visitsError) {
    throw visitsError;
  }

  const mappedVisits =
    visits?.map((visit) => ({
      id: visit.id,
      shoeType: visit.shoe_type,
      visitDate: visit.visit_date,
      receiptNumber: visit.receipt_number,
      notes: visit.notes,
      quantity: visit.quantity || 1,
      qualifies: isQualifyingLoyaltyVisit(visit.quantity || 1),
      points: getLoyaltyVisitPoints(visit.quantity || 1),
      createdAt: visit.created_at,
    })) || [];
  const rewardClaims = await loadRewardClaims(supabase, customer.id);
  const totalPoints = mappedVisits.reduce((sum, visit) => sum + visit.points, 0);
  const claimedPoints = rewardClaims.reduce((sum, claim) => sum + claim.pointsClaimed, 0);
  const progress = getLoyaltyProgress(
    totalPoints,
    mappedVisits.length,
    rewardClaims.length,
    claimedPoints,
  );

  return {
    found: true,
    message: "",
    customer: {
      id: customer.id,
      customerName: customer.customer_name,
      whatsAppNumber: formatWhatsAppNumber(customer.whatsapp_number),
    },
    progress,
    visits: mappedVisits,
    rewardClaims,
  };
}

export async function getLoyaltyCustomerStatus(rawWhatsAppNumber = "") {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      found: false,
      hasAccount: false,
      message:
        "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty status checks.",
      customer: null,
    };
  }

  const whatsAppNumber = normalizeWhatsAppNumber(rawWhatsAppNumber);

  if (!whatsAppNumber) {
    return {
      found: false,
      hasAccount: false,
      message: "",
      customer: null,
    };
  }

  const { data: customer, error } = await supabase
    .from("loyalty_customers")
    .select("id, customer_name, whatsapp_number, loyalty_accounts(customer_id)")
    .eq("whatsapp_number", whatsAppNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!customer) {
    return {
      found: false,
      hasAccount: false,
      message: "No loyalty profile was found for that WhatsApp number yet.",
      customer: null,
    };
  }

  return {
    found: true,
    hasAccount: Boolean(customer.loyalty_accounts),
    message: "",
    customer: {
      id: customer.id,
      customerName: customer.customer_name,
      whatsAppNumber: customer.whatsapp_number,
    },
  };
}
