import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { normalizeWhatsAppNumber } from "../../../lib/loyalty";
import {
  setLoyaltySessionCookie,
  verifyLoyaltyPassword,
} from "../../../lib/loyalty-auth";

export async function POST(request) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        signedIn: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty sign-in.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const whatsAppNumber = normalizeWhatsAppNumber(body.whatsAppNumber);
    const password = body.password || "";

    if (!whatsAppNumber || !password) {
      return NextResponse.json(
        {
          signedIn: false,
          message: "Phone number and password are required.",
        },
        { status: 400 },
      );
    }

    const { data: customer, error: customerError } = await supabase
      .from("loyalty_customers")
      .select("id, customer_name, whatsapp_number")
      .eq("whatsapp_number", whatsAppNumber)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          signedIn: false,
          message: "No loyalty account was found for that WhatsApp number.",
        },
        { status: 404 },
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("loyalty_accounts")
      .select("customer_id, password_salt, password_hash")
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json(
        {
          signedIn: false,
          message: "No loyalty account was found for that WhatsApp number.",
        },
        { status: 404 },
      );
    }

    const passwordValid = verifyLoyaltyPassword(
      password,
      account.password_salt,
      account.password_hash,
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          signedIn: false,
          message: "Incorrect password.",
        },
        { status: 401 },
      );
    }

    await setLoyaltySessionCookie({
      customerId: account.customer_id,
      whatsAppNumber,
    });

    return NextResponse.json({
      signedIn: true,
      message: "Signed in successfully.",
      customer: {
        id: customer.id,
        customerName: customer.customer_name,
        whatsAppNumber: customer.whatsapp_number,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        signedIn: false,
        message: error.message || "Unable to sign in.",
      },
      { status: 500 },
    );
  }
}
