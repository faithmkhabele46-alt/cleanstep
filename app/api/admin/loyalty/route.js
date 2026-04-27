import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import {
  buildLoyaltyDashboardUrl,
  buildLoyaltyShareMessage,
  formatWhatsAppNumber,
  getLoyaltyProgress,
  normalizeWhatsAppNumber,
} from "../../../lib/loyalty";

async function loadRecentVisits(supabase) {
  const { data, error } = await supabase
    .from("loyalty_visits")
    .select(
      "id, visit_date, shoe_type, receipt_number, notes, created_at, loyalty_customers(id, customer_name, whatsapp_number)",
    )
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data || []).map((visit) => ({
    id: visit.id,
    visitDate: visit.visit_date,
    shoeType: visit.shoe_type,
    receiptNumber: visit.receipt_number,
    notes: visit.notes,
    createdAt: visit.created_at,
    customerId: visit.loyalty_customers?.id || "",
    customerName: visit.loyalty_customers?.customer_name || "Unknown customer",
    whatsAppNumber: formatWhatsAppNumber(visit.loyalty_customers?.whatsapp_number || ""),
  }));
}

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      message:
        "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty visits.",
      items: [],
    });
  }

  try {
    const items = await loadRecentVisits(supabase);

    return NextResponse.json({
      configured: true,
      message: "",
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        message: error.message || "Unable to load loyalty visits.",
        items: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request) {
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
    const shoeType = body.shoeType?.trim();
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
        visit_date: visitDate,
        receipt_number: receiptNumber,
        notes,
      })
      .select("id, visit_date, shoe_type, receipt_number, notes, created_at")
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

    const progress = getLoyaltyProgress(count || 0);
    const dashboardUrl = buildLoyaltyDashboardUrl(whatsAppNumber);
    const shareMessage = buildLoyaltyShareMessage({
      customerName,
      whatsAppNumber,
      totalVisits: progress.totalVisits,
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
        createdAt: savedVisit.created_at,
      },
      customer: {
        id: customerId,
        customerName,
        whatsAppNumber: formatWhatsAppNumber(whatsAppNumber),
      },
      progress,
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
