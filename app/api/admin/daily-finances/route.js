import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import {
  DAILY_FINANCE_PRODUCTS,
  calculateDailyFinancePricing,
  getJohannesburgDateString,
  summarizeDailyFinanceSales,
} from "../../../lib/daily-finances";

async function loadSalesByDate(supabase, saleDate) {
  const { data, error } = await supabase
    .from("daily_finance_sales")
    .select(
      "id, product_code, product_name, category, quantity, unit_price, total, payment_method, sale_date, created_at",
    )
    .eq("sale_date", saleDate)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((item) => ({
    id: item.id,
    productCode: item.product_code,
    productName: item.product_name,
    category: item.category,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price || 0),
    total: Number(item.total || 0),
    paymentMethod: item.payment_method,
    saleDate: item.sale_date,
    createdAt: item.created_at,
  }));
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        configured: true,
        message: "Admin sign-in is required.",
        saleDate: getJohannesburgDateString(),
        products: DAILY_FINANCE_PRODUCTS,
        items: [],
        summary: summarizeDailyFinanceSales([]),
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      message:
        "Supabase finance access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable daily finances.",
      saleDate: getJohannesburgDateString(),
      products: DAILY_FINANCE_PRODUCTS,
      items: [],
      summary: summarizeDailyFinanceSales([]),
    });
  }

  const { searchParams } = new URL(request.url);
  const saleDate = searchParams.get("saleDate") || getJohannesburgDateString();

  try {
    const items = await loadSalesByDate(supabase, saleDate);

    return NextResponse.json({
      configured: true,
      message: "",
      saleDate,
      products: DAILY_FINANCE_PRODUCTS,
      items,
      summary: summarizeDailyFinanceSales(items),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        message: error.message || "Unable to load daily finances.",
        saleDate,
        products: DAILY_FINANCE_PRODUCTS,
        items: [],
        summary: summarizeDailyFinanceSales([]),
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
          "Supabase finance access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save daily finances.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const productCode = body.productCode;
    const paymentMethod = body.paymentMethod;
    const saleDate = body.saleDate || getJohannesburgDateString();
    const quantity = Math.max(1, Number(body.quantity) || 1);

    if (!productCode || !paymentMethod) {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose the product and payment method first.",
        },
        { status: 400 },
      );
    }

    if (!["cash", "card"].includes(paymentMethod)) {
      return NextResponse.json(
        {
          saved: false,
          message: "Payment method must be cash or card.",
        },
        { status: 400 },
      );
    }

    const pricing = calculateDailyFinancePricing(productCode, quantity);

    if (!pricing.product) {
      return NextResponse.json(
        {
          saved: false,
          message: "That item is not supported in daily finances.",
        },
        { status: 400 },
      );
    }

    const { data: savedSale, error } = await supabase
      .from("daily_finance_sales")
      .insert({
        product_code: pricing.product.code,
        product_name: pricing.product.name,
        category: pricing.product.category,
        quantity: pricing.quantity,
        unit_price: pricing.unitPrice,
        total: pricing.total,
        payment_method: paymentMethod,
        sale_date: saleDate,
      })
      .select(
        "id, product_code, product_name, category, quantity, unit_price, total, payment_method, sale_date, created_at",
      )
      .single();

    if (error) {
      throw error;
    }

    const items = await loadSalesByDate(supabase, saleDate);

    return NextResponse.json({
      saved: true,
      message: `${pricing.product.name} sale saved successfully.`,
      item: {
        id: savedSale.id,
        productCode: savedSale.product_code,
        productName: savedSale.product_name,
        category: savedSale.category,
        quantity: savedSale.quantity,
        unitPrice: Number(savedSale.unit_price || 0),
        total: Number(savedSale.total || 0),
        paymentMethod: savedSale.payment_method,
        saleDate: savedSale.sale_date,
        createdAt: savedSale.created_at,
      },
      saleDate,
      items,
      summary: summarizeDailyFinanceSales(items),
      pricing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        saved: false,
        message: error.message || "Unable to save the sale.",
      },
      { status: 500 },
    );
  }
}
