import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { createServerSupabaseClient } from "../../../lib/supabase-server";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        items: [],
        configured: true,
        message: "Admin sign-in is required.",
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      items: [],
      configured: false,
      message:
        "Supabase admin access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable live bookings.",
    });
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, service_title, primary_item, location, booking_date, booking_time, total, deposit, status, customer_name, customer_email, customer_phone, selections, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      {
        items: [],
        configured: true,
        message: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    items: data || [],
    configured: true,
    message: "",
  });
}
