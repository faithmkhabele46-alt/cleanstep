import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import {
  buildLoyaltyDashboardUrl,
  buildLoyaltyShareMessage,
  formatWhatsAppNumber,
  getLoyaltyVisitPoints,
  getLoyaltyProgress,
  isQualifyingLoyaltyVisit,
  normalizeWhatsAppNumber,
} from "../../../lib/loyalty";

function isMissingRewardClaimsTable(error) {
  return (
    error?.code === "42P01" ||
    error?.message?.toLowerCase().includes("loyalty_reward_claims")
  );
}

function mapLoyaltyVisit(visit) {
  return {
    id: visit.id,
    visitDate: visit.visit_date,
    shoeType: visit.shoe_type,
    receiptNumber: visit.receipt_number,
    notes: visit.notes,
    quantity: visit.quantity || 1,
    qualifies: isQualifyingLoyaltyVisit(visit.quantity || 1),
    points: getLoyaltyVisitPoints(visit.quantity || 1),
    createdAt: visit.created_at,
    customerId: visit.loyalty_customers?.id || visit.customer_id || "",
    customerName: visit.loyalty_customers?.customer_name || "Unknown customer",
    whatsAppNumber: formatWhatsAppNumber(visit.loyalty_customers?.whatsapp_number || ""),
  };
}

async function loadRecentVisits(supabase) {
  const { data, error } = await supabase
    .from("loyalty_visits")
    .select(
      "id, visit_date, shoe_type, receipt_number, notes, quantity, created_at, loyalty_customers(id, customer_name, whatsapp_number)",
    )
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data || []).map(mapLoyaltyVisit);
}

async function loadCustomers(supabase) {
  const { data, error } = await supabase
    .from("loyalty_customers")
    .select("id, customer_name, whatsapp_number, updated_at, created_at")
    .order("customer_name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadCustomerById(supabase, customerId) {
  const { data, error } = await supabase
    .from("loyalty_customers")
    .select("id, customer_name, whatsapp_number")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadRewardClaims(supabase, customerId) {
  const { data, error } = await supabase
    .from("loyalty_reward_claims")
    .select("id, claimed_at, notes, created_at")
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
    notes: claim.notes,
    createdAt: claim.created_at,
  }));
}

async function loadCustomerLoyaltyDetail(supabase, customerId) {
  const customer = await loadCustomerById(supabase, customerId);

  if (!customer) {
    return null;
  }

  const { data: visits, error: visitsError } = await supabase
    .from("loyalty_visits")
    .select("id, customer_id, visit_date, shoe_type, receipt_number, notes, quantity, created_at")
    .eq("customer_id", customerId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (visitsError) {
    throw visitsError;
  }

  const mappedVisits = (visits || []).map(mapLoyaltyVisit);
  const rewardClaims = await loadRewardClaims(supabase, customerId);
  const earnedPoints = mappedVisits.reduce((sum, visit) => sum + visit.points, 0);
  const progress = getLoyaltyProgress(earnedPoints, mappedVisits.length, rewardClaims.length);

  return {
    customer: {
      id: customer.id,
      customerName: customer.customer_name,
      whatsAppNumber: formatWhatsAppNumber(customer.whatsapp_number),
    },
    visits: mappedVisits,
    rewardClaims,
    progress,
    dashboardUrl: buildLoyaltyDashboardUrl(customer.whatsapp_number),
  };
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        configured: true,
        message: "Admin sign-in is required.",
        items: [],
        customers: [],
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      message:
        "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty visits.",
      items: [],
      customers: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  try {
    if (customerId) {
      const detail = await loadCustomerLoyaltyDetail(supabase, customerId);

      if (!detail) {
        return NextResponse.json(
          {
            configured: true,
            message: "That loyalty customer could not be found anymore.",
            customer: null,
            visits: [],
            rewardClaims: [],
            progress: null,
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        configured: true,
        message: "",
        ...detail,
      });
    }

    const [items, customers] = await Promise.all([
      loadRecentVisits(supabase),
      loadCustomers(supabase),
    ]);
    const latestVisitByCustomer = new Map();

    items.forEach((visit) => {
      if (!visit.customerId || latestVisitByCustomer.has(visit.customerId)) {
        return;
      }

      latestVisitByCustomer.set(visit.customerId, visit);
    });

    return NextResponse.json({
      configured: true,
      message: "",
      items,
      customers: customers.map((customer) => {
        const latestVisit = latestVisitByCustomer.get(customer.id);

        return {
          customerId: customer.id,
          customerName: customer.customer_name,
          whatsAppNumber: formatWhatsAppNumber(customer.whatsapp_number),
          latestVisitDate: latestVisit?.visitDate || "",
          latestShoeType: latestVisit?.shoeType || "",
          hasVisits: Boolean(latestVisit),
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        message: error.message || "Unable to load loyalty visits.",
        items: [],
        customers: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        saved: false,
        message: "Admin sign-in is required.",
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        saved: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save visits.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const customerName = body.customerName?.trim();
    const whatsAppNumber = normalizeWhatsAppNumber(body.whatsAppNumber);
    const visitItems = Array.isArray(body.visitItems)
      ? body.visitItems
          .map((item) => ({
            label: item?.label?.trim(),
            quantity: Math.max(1, Number(item?.quantity) || 1),
          }))
          .filter((item) => item.label)
      : [];
    const shoeType =
      body.shoeType?.trim() ||
      visitItems
        .map((item) =>
          item.quantity > 1 ? `${item.label} x${item.quantity}` : item.label,
        )
        .join(" | ");
    const quantity =
      visitItems.length > 0
        ? visitItems.reduce((sum, item) => sum + item.quantity, 0)
        : Math.max(1, Number(body.quantity) || 1);
    const visitDate = body.visitDate;
    const receiptNumber = body.receiptNumber?.trim() || null;
    const notes = body.notes?.trim() || null;

    if (!customerName || !whatsAppNumber || !shoeType || !visitDate) {
      return NextResponse.json(
        {
          saved: false,
          message: "Name, WhatsApp number, shoe type, and visit date are required.",
        },
        { status: 400 },
      );
    }

    const { data: existingCustomer, error: customerLookupError } = await supabase
      .from("loyalty_customers")
      .select("id, customer_name, whatsapp_number, loyalty_accounts(customer_id)")
      .eq("whatsapp_number", whatsAppNumber)
      .maybeSingle();

    if (customerLookupError) {
      throw customerLookupError;
    }

    let customerId = existingCustomer?.id;

    if (!customerId) {
      const { data: insertedCustomer, error: insertCustomerError } = await supabase
        .from("loyalty_customers")
        .insert({
          customer_name: customerName,
          whatsapp_number: whatsAppNumber,
        })
        .select("id")
        .single();

      if (insertCustomerError) {
        throw insertCustomerError;
      }

      customerId = insertedCustomer.id;
    } else if (existingCustomer.customer_name !== customerName) {
      const { error: updateCustomerError } = await supabase
        .from("loyalty_customers")
        .update({
          customer_name: customerName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (updateCustomerError) {
        throw updateCustomerError;
      }
    }

    const { data: savedVisit, error: insertVisitError } = await supabase
      .from("loyalty_visits")
      .insert({
        customer_id: customerId,
        shoe_type: shoeType,
        quantity,
        visit_date: visitDate,
        receipt_number: receiptNumber,
        notes,
      })
      .select("id, visit_date, shoe_type, receipt_number, notes, quantity, created_at")
      .single();

    if (insertVisitError) {
      throw insertVisitError;
    }

    const { count, error: countError } = await supabase
      .from("loyalty_visits")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId);

    if (countError) {
      throw countError;
    }

    const { data: allVisits, error: visitsError } = await supabase
      .from("loyalty_visits")
      .select("quantity")
      .eq("customer_id", customerId);

    if (visitsError) {
      throw visitsError;
    }

    const totalPoints = (allVisits || []).reduce(
      (sum, visit) => sum + getLoyaltyVisitPoints(visit.quantity || 1),
      0,
    );
    const rewardClaims = await loadRewardClaims(supabase, customerId);
    const progress = getLoyaltyProgress(totalPoints, count || 0, rewardClaims.length);
    const dashboardUrl = buildLoyaltyDashboardUrl(whatsAppNumber);
    const shareMessage = buildLoyaltyShareMessage({
      customerName,
      whatsAppNumber,
      totalVisits: progress.totalVisits,
      totalPoints,
      claimedRewards: rewardClaims.length,
    });

    return NextResponse.json({
      saved: true,
      message: "Loyalty visit saved successfully.",
      visit: {
        id: savedVisit.id,
        visitDate: savedVisit.visit_date,
        shoeType: savedVisit.shoe_type,
        receiptNumber: savedVisit.receipt_number,
        notes: savedVisit.notes,
        quantity: savedVisit.quantity || 1,
        points: getLoyaltyVisitPoints(savedVisit.quantity || 1),
        createdAt: savedVisit.created_at,
      },
      customer: {
        id: customerId,
        customerName,
        whatsAppNumber: formatWhatsAppNumber(whatsAppNumber),
      },
      progress,
      rewardClaims,
      dashboardUrl,
      shareMessage,
      requiresRegistration: !existingCustomer?.loyalty_accounts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        saved: false,
        message: error.message || "Unable to save loyalty visit.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        saved: false,
        message: "Admin sign-in is required.",
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        saved: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to claim rewards.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const action = body.action;
    const customerId = body.customerId?.trim();

    if (action !== "claimReward") {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose a supported loyalty action first.",
        },
        { status: 400 },
      );
    }

    if (!customerId) {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose the customer who claimed the free wash first.",
        },
        { status: 400 },
      );
    }

    const detail = await loadCustomerLoyaltyDetail(supabase, customerId);

    if (!detail) {
      return NextResponse.json(
        {
          saved: false,
          message: "That loyalty customer could not be found anymore.",
        },
        { status: 404 },
      );
    }

    const { error } = await supabase.from("loyalty_reward_claims").insert({
      customer_id: customerId,
      claimed_at: new Date().toISOString(),
      notes: body.notes?.trim() || null,
    });

    if (error) {
      throw error;
    }

    const updatedDetail = await loadCustomerLoyaltyDetail(supabase, customerId);

    return NextResponse.json({
      saved: true,
      message: "Free wash claim recorded. The loyalty bar has been reset.",
      ...updatedDetail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        saved: false,
        message: error.message || "Unable to record the free wash claim.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        deleted: false,
        message: "Admin sign-in is required.",
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        deleted: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to delete visits.",
      },
      { status: 500 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");
    const customerId = searchParams.get("customerId");

    if (!visitId) {
      return NextResponse.json(
        {
          deleted: false,
          message: "Choose the visit record you want to delete first.",
        },
        { status: 400 },
      );
    }

    let deleteQuery = supabase.from("loyalty_visits").delete().eq("id", visitId);

    if (customerId) {
      deleteQuery = deleteQuery.eq("customer_id", customerId);
    }

    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }

    const detail = customerId ? await loadCustomerLoyaltyDetail(supabase, customerId) : null;

    return NextResponse.json({
      deleted: true,
      message: "Loyalty visit deleted successfully.",
      ...(detail || {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        deleted: false,
        message: error.message || "Unable to delete the loyalty visit.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        saved: false,
        message: "Admin sign-in is required.",
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        saved: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to update customers.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const customerId = body.customerId?.trim();
    const customerName = body.customerName?.trim();
    const whatsAppNumber = normalizeWhatsAppNumber(body.whatsAppNumber);

    if (!customerId || !customerName || !whatsAppNumber) {
      return NextResponse.json(
        {
          saved: false,
          message: "Customer, name, and WhatsApp number are required.",
        },
        { status: 400 },
      );
    }

    const existingCustomer = await loadCustomerById(supabase, customerId);

    if (!existingCustomer) {
      return NextResponse.json(
        {
          saved: false,
          message: "That loyalty customer could not be found anymore.",
        },
        { status: 404 },
      );
    }

    const { data: duplicateCustomer, error: duplicateError } = await supabase
      .from("loyalty_customers")
      .select("id")
      .eq("whatsapp_number", whatsAppNumber)
      .neq("id", customerId)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicateCustomer) {
      return NextResponse.json(
        {
          saved: false,
          message: "That WhatsApp number already belongs to another loyalty customer.",
        },
        { status: 409 },
      );
    }

    const { error: updateError } = await supabase
      .from("loyalty_customers")
      .update({
        customer_name: customerName,
        whatsapp_number: whatsAppNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      saved: true,
      message: "Customer details updated successfully.",
      customer: {
        id: customerId,
        customerName,
        whatsAppNumber: formatWhatsAppNumber(whatsAppNumber),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        saved: false,
        message: error.message || "Unable to update customer details.",
      },
      { status: 500 },
    );
  }
}
