import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { normalizeWhatsAppNumber } from "../../../lib/loyalty";

export async function POST(request) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        found: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty status checks.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const whatsAppNumber = normalizeWhatsAppNumber(body.whatsAppNumber);

    if (!whatsAppNumber) {
      return NextResponse.json(
        {
          found: false,
          message: "Enter the WhatsApp number used at Cleanstep.",
        },
        { status: 400 },
      );
    }

    const { data: customer, error: customerError } = await supabase
      .from("loyalty_customers")
      .select("id, customer_name, whatsapp_number, loyalty_accounts(customer_id)")
      .eq("whatsapp_number", whatsAppNumber)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer) {
      return NextResponse.json({
        found: false,
        canRegister: true,
        message: "",
      });
    }

    return NextResponse.json({
      found: true,
      customer: {
        id: customer.id,
        customerName: customer.customer_name,
        whatsAppNumber: customer.whatsapp_number,
      },
      hasAccount: Boolean(customer.loyalty_accounts),
      message: "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        found: false,
        message: error.message || "Unable to check loyalty status.",
      },
      { status: 500 },
    );
  }
}
