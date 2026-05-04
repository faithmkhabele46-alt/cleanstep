import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { normalizeWhatsAppNumber } from "../../../lib/loyalty";
import {
  hashLoyaltyPassword,
  setLoyaltySessionCookie,
} from "../../../lib/loyalty-auth";

export async function POST(request) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        registered: false,
        message:
          "Supabase loyalty access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable loyalty registration.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const customerName = body.customerName?.trim() || "";
    const whatsAppNumber = normalizeWhatsAppNumber(body.whatsAppNumber);
    const password = body.password || "";
    const confirmPassword = body.confirmPassword || "";

    if (!customerName || !whatsAppNumber || !password || !confirmPassword) {
      return NextResponse.json(
        {
          registered: false,
          message: "Name, phone number, password, and confirm password are required.",
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          registered: false,
          message: "Use a password with at least 6 characters.",
        },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          registered: false,
          message: "Password and confirm password do not match.",
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

    let loyaltyCustomer = customer;

    if (!loyaltyCustomer) {
      const { data: insertedCustomer, error: insertCustomerError } = await supabase
        .from("loyalty_customers")
        .insert({
          customer_name: customerName,
          whatsapp_number: whatsAppNumber,
        })
        .select("id, customer_name, whatsapp_number")
        .single();

      if (insertCustomerError) {
        throw insertCustomerError;
      }

      loyaltyCustomer = insertedCustomer;
    }

    if (loyaltyCustomer.loyalty_accounts) {
      return NextResponse.json(
        {
          registered: false,
          message: "A loyalty account already exists for this WhatsApp number. Please sign in.",
        },
        { status: 409 },
      );
    }

    const { salt, hash } = hashLoyaltyPassword(password);

    const { error: insertAccountError } = await supabase
      .from("loyalty_accounts")
      .insert({
        customer_id: loyaltyCustomer.id,
        password_salt: salt,
        password_hash: hash,
      });

    if (insertAccountError) {
      throw insertAccountError;
    }

    await setLoyaltySessionCookie({
      customerId: loyaltyCustomer.id,
      whatsAppNumber,
    });

    return NextResponse.json({
      registered: true,
      message: "Loyalty account created successfully.",
      customer: {
        id: loyaltyCustomer.id,
        customerName: loyaltyCustomer.customer_name,
        whatsAppNumber: loyaltyCustomer.whatsapp_number,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        registered: false,
        message: error.message || "Unable to create the loyalty account.",
      },
      { status: 500 },
    );
  }
}
