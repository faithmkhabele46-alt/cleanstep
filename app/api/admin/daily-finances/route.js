import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import {
  DAILY_FINANCE_PRODUCTS,
  calculateDailyFinancePricing,
  getDailyFinanceProduct,
  getJohannesburgDateString,
  summarizeDailyFinanceHistory,
  summarizeDailyFinanceSales,
} from "../../../lib/daily-finances";

async function loadSalesByDate(supabase, saleDate) {
  const { data, error } = await supabase
    .from("daily_finance_sales")
    .select(
      "id, transaction_group_id, product_code, product_name, category, quantity, unit_price, total, payment_method, sale_date, created_at",
    )
    .eq("sale_date", saleDate)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((item) => ({
    id: item.id,
    transactionGroupId: item.transaction_group_id,
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

async function loadRecentSales(supabase) {
  const { data, error } = await supabase
    .from("daily_finance_sales")
    .select(
      "id, transaction_group_id, product_code, product_name, category, quantity, unit_price, total, payment_method, sale_date, created_at",
    )
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  return (data || []).map((item) => ({
    id: item.id,
    transactionGroupId: item.transaction_group_id,
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
    const [items, recentItems] = await Promise.all([
      loadSalesByDate(supabase, saleDate),
      loadRecentSales(supabase),
    ]);

    return NextResponse.json({
      configured: true,
      message: "",
      saleDate,
      products: DAILY_FINANCE_PRODUCTS,
      items,
      summary: summarizeDailyFinanceSales(items),
      history: summarizeDailyFinanceHistory(recentItems),
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
        history: [],
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
    const paymentMethod = body.paymentMethod;
    const saleDate = body.saleDate || getJohannesburgDateString();
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!paymentMethod) {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose the payment method first.",
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

    if (lines.length === 0) {
      return NextResponse.json(
        {
          saved: false,
          message: "Add at least one item to the transaction first.",
        },
        { status: 400 },
      );
    }

    const transactionGroupId = crypto.randomUUID();
    const preparedLines = [];

    for (const line of lines) {
      const pricing = calculateDailyFinancePricing(
        line.productCode,
        line.quantity,
        line.customAmount,
      );

      if (!pricing.product) {
        return NextResponse.json(
          {
            saved: false,
            message: "One of the selected items is not supported in daily finances.",
          },
          { status: 400 },
        );
      }

      if (pricing.product.allowsCustomAmount && pricing.unitPrice <= 0) {
        return NextResponse.json(
          {
            saved: false,
            message: "Others needs a valid amount before you can save the transaction.",
          },
          { status: 400 },
        );
      }

      preparedLines.push({
        transaction_group_id: transactionGroupId,
        product_code: pricing.product.code,
        product_name: line.customLabel?.trim() || pricing.product.name,
        category: pricing.product.category,
        quantity: pricing.quantity,
        unit_price: pricing.unitPrice,
        total: pricing.total,
        payment_method: paymentMethod,
        sale_date: saleDate,
      });
    }

    const { data: savedSales, error } = await supabase
      .from("daily_finance_sales")
      .insert(preparedLines)
      .select(
        "id, transaction_group_id, product_code, product_name, category, quantity, unit_price, total, payment_method, sale_date, created_at",
      );

    if (error) {
      throw error;
    }

    const [items, recentItems] = await Promise.all([
      loadSalesByDate(supabase, saleDate),
      loadRecentSales(supabase),
    ]);

    return NextResponse.json({
      saved: true,
      message: `Transaction saved successfully with ${preparedLines.length} item${preparedLines.length === 1 ? "" : "s"}.`,
      itemsSaved: (savedSales || []).map((savedSale) => ({
        id: savedSale.id,
        transactionGroupId: savedSale.transaction_group_id,
        productCode: savedSale.product_code,
        productName: savedSale.product_name,
        category: savedSale.category,
        quantity: savedSale.quantity,
        unitPrice: Number(savedSale.unit_price || 0),
        total: Number(savedSale.total || 0),
        paymentMethod: savedSale.payment_method,
        saleDate: savedSale.sale_date,
        createdAt: savedSale.created_at,
      })),
      saleDate,
      items,
      summary: summarizeDailyFinanceSales(items),
      history: summarizeDailyFinanceHistory(recentItems),
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
          "Supabase finance access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to update daily finances.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const saleId = body.saleId;
    const productCode = body.productCode;
    const paymentMethod = body.paymentMethod;
    const saleDate = body.saleDate || getJohannesburgDateString();
    const quantity = Math.max(1, Number(body.quantity) || 1);

    if (!saleId || !productCode || !paymentMethod) {
      return NextResponse.json(
        {
          saved: false,
          message: "Sale, product, and payment method are required.",
        },
        { status: 400 },
      );
    }

    const product = getDailyFinanceProduct(productCode);
    const pricing = calculateDailyFinancePricing(productCode, quantity);

    if (!product || !pricing.product) {
      return NextResponse.json(
        {
          saved: false,
          message: "That item is not supported in daily finances.",
        },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("daily_finance_sales")
      .update({
        product_code: product.code,
        product_name: product.name,
        category: product.category,
        quantity: pricing.quantity,
        unit_price: pricing.unitPrice,
        total: pricing.total,
        payment_method: paymentMethod,
        sale_date: saleDate,
      })
      .eq("id", saleId);

    if (error) {
      throw error;
    }

    const [items, recentItems] = await Promise.all([
      loadSalesByDate(supabase, saleDate),
      loadRecentSales(supabase),
    ]);

    return NextResponse.json({
      saved: true,
      message: `${product.name} sale updated successfully.`,
      saleDate,
      items,
      summary: summarizeDailyFinanceSales(items),
      history: summarizeDailyFinanceHistory(recentItems),
      pricing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        saved: false,
        message: error.message || "Unable to update the sale.",
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
          "Supabase finance access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to update daily finances.",
      },
      { status: 500 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get("saleId");
    const transactionGroupId = searchParams.get("transactionGroupId");
    const saleDate = searchParams.get("saleDate") || getJohannesburgDateString();

    if (!saleId && !transactionGroupId) {
      return NextResponse.json(
        {
          deleted: false,
          message: "Choose the transaction you want to delete first.",
        },
        { status: 400 },
      );
    }

    let deleteQuery = supabase.from("daily_finance_sales").delete();

    if (transactionGroupId) {
      deleteQuery = deleteQuery.eq("transaction_group_id", transactionGroupId);
    } else {
      deleteQuery = deleteQuery.eq("id", saleId);
    }

    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }

    const [items, recentItems] = await Promise.all([
      loadSalesByDate(supabase, saleDate),
      loadRecentSales(supabase),
    ]);

    return NextResponse.json({
      deleted: true,
      message: "Sale deleted successfully.",
      saleDate,
      items,
      summary: summarizeDailyFinanceSales(items),
      history: summarizeDailyFinanceHistory(recentItems),
    });
  } catch (error) {
    return NextResponse.json(
      {
        deleted: false,
        message: error.message || "Unable to delete the sale.",
      },
      { status: 500 },
    );
  }
}
