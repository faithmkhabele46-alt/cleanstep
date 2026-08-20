import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isAdminAuthenticated } from "../../../lib/admin-auth";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import {
  formatWhatsAppNumber,
  getLoyaltyVisitPoints,
  isQualifyingLoyaltyVisit,
  normalizeWhatsAppNumber,
} from "../../../lib/loyalty";

export const runtime = "nodejs";

const MANAGEMENT_REPORT_START_DATE = "2026-03-01";
const MANAGEMENT_REPORT_END_DATE = "2027-02-28";
const MANAGEMENT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "templates",
  "management-report-2026-2027.xlsx",
);
const MANAGEMENT_MONTHS = [
  { month: 3, year: 2026, label: "MARCH" },
  { month: 4, year: 2026, label: "APRIL" },
  { month: 5, year: 2026, label: "MAY" },
  { month: 6, year: 2026, label: "JUNE" },
  { month: 7, year: 2026, label: "JULY" },
  { month: 8, year: 2026, label: "AUGUST" },
  { month: 9, year: 2026, label: "SEPTEMBER" },
  { month: 10, year: 2026, label: "OCTOBER" },
  { month: 11, year: 2026, label: "NOVEMBER" },
  { month: 12, year: 2026, label: "DECEMBER" },
  { month: 1, year: 2027, label: "JANUARY" },
  { month: 2, year: 2027, label: "FEBRUARY" },
];

function isMissingManagementSchema(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    message.includes("cleanstep_services") ||
    message.includes("cleanstep_visits") ||
    message.includes("cleanstep_visit_items")
  );
}

function mapCustomer(customer) {
  return {
    customerId: customer.id,
    customerName: customer.customer_name,
    whatsAppNumber: formatWhatsAppNumber(customer.whatsapp_number),
  };
}

function mapService(service) {
  const category = service.cleanstep_service_categories || {};

  return {
    id: service.id,
    code: service.code,
    name: service.name,
    pricingType: service.pricing_type,
    defaultUnitPrice:
      service.default_unit_price === null ? null : Number(service.default_unit_price || 0),
    unitLabel: service.unit_label,
    loyaltyEligible: Boolean(service.loyalty_eligible),
    allowPriceOverride: Boolean(service.allow_price_override),
    notes: service.notes || "",
    category: {
      id: category.id,
      code: category.code,
      name: category.name,
      reportGroup: category.report_group,
    },
  };
}

function mapVisit(visit) {
  return {
    id: visit.id,
    customerName: visit.customer_name_snapshot,
    whatsAppNumber: formatWhatsAppNumber(visit.whatsapp_snapshot),
    visitDate: visit.visit_date,
    status: visit.status,
    paymentMethod: visit.payment_method || "",
    total: Number(visit.total || 0),
    amountPaid: Number(visit.amount_paid || 0),
    notes: visit.notes || "",
    items: (visit.cleanstep_visit_items || []).map((item) => ({
      id: item.id,
      serviceName: item.service_name_snapshot,
      reportGroup: item.report_group_snapshot,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      lineTotal: Number(item.line_total || 0),
      thirdPartyPartner: item.third_party_partner || "",
      prepStatus: item.prep_status,
      prepDueAt: item.prep_due_at,
      deliveryStatus: item.delivery_status,
    })),
  };
}

function getJohannesburgDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getPrepDueAtForVisitDate(visitDate) {
  const [year, month, day] = String(visitDate).split("-").map(Number);
  const dueDate = new Date(Date.UTC(year, month - 1, day + 2, 6, 0, 0));

  return dueDate.toISOString();
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getJohannesburgDateString(date = new Date()) {
  const parts = getJohannesburgDateParts(date);

  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function getPeriodStarts(today) {
  const [year, month] = today.split("-").map(Number);
  const financialYearStartYear = month >= 3 ? year : year - 1;

  return {
    monthStart: `${year}-${padDatePart(month)}-01`,
    yearStart: `${financialYearStartYear}-03-01`,
  };
}

function normalizeManagementReportGroup(reportGroup = "") {
  if (["mattresses", "couches"].includes(reportGroup)) {
    return "upholstery";
  }

  return reportGroup || "other_services";
}

function getShopSaleReportGroup(row) {
  const category = String(row.category || "").toLowerCase();

  if (category.includes("cop") || category.includes("print")) {
    return "print_copies";
  }

  return "retail";
}

function addDaysToDateString(dateString, dayOffset) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayOffset);

  return date.toISOString().slice(0, 10);
}

function getReportRange(searchParams) {
  const today = getJohannesburgDateString();
  const preset = searchParams.get("preset") || "today";
  const selectedDate = searchParams.get("date") || today;
  const selectedMonth = searchParams.get("month") || today.slice(0, 7);
  const customStart = searchParams.get("startDate");
  const customEnd = searchParams.get("endDate");

  if (preset === "yesterday") {
    const yesterday = addDaysToDateString(today, -1);

    return { preset, startDate: yesterday, endDate: yesterday, label: "Yesterday" };
  }

  if (preset === "selected-date") {
    return { preset, startDate: selectedDate, endDate: selectedDate, label: selectedDate };
  }

  if (preset === "this-week") {
    const date = new Date(`${today}T00:00:00.000Z`);
    const day = date.getUTCDay() || 7;
    const startDate = addDaysToDateString(today, 1 - day);

    return { preset, startDate, endDate: today, label: "This week" };
  }

  if (preset === "selected-month") {
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = `${year}-${padDatePart(month)}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

    return { preset, startDate, endDate, label: selectedMonth };
  }

  if (preset === "custom") {
    return {
      preset,
      startDate: customStart || today,
      endDate: customEnd || customStart || today,
      label: "Custom range",
    };
  }

  return { preset: "today", startDate: today, endDate: today, label: "Today" };
}

function getEmptyOwnerSummary() {
  return {
    today: {
      serviceRevenue: 0,
      shopRevenue: 0,
      totalRevenue: 0,
      expenses: 0,
      netRevenue: 0,
      itemsReceived: 0,
      shoesReceived: 0,
      carpetsReceived: 0,
      thirdPartyRevenue: 0,
      thirdPartyItems: 0,
      jobsDueToday: 0,
      overdueJobs: 0,
      dueTodayTotal: 0,
      dueTodayReady: 0,
      dueTodayRemaining: 0,
      dueTodayPercentage: 0,
      outstandingDeliveries: 0,
    },
    month: {
      serviceRevenue: 0,
      shopRevenue: 0,
      totalRevenue: 0,
      expenses: 0,
      netRevenue: 0,
      itemsReceived: 0,
    },
    yearToDate: {
      serviceRevenue: 0,
      shopRevenue: 0,
      totalRevenue: 0,
      expenses: 0,
      netRevenue: 0,
      itemsReceived: 0,
    },
    selectedRange: {
      label: "Today",
      startDate: "",
      endDate: "",
      serviceRevenue: 0,
      shopRevenue: 0,
      totalRevenue: 0,
      expenses: 0,
      netRevenue: 0,
      itemsReceived: 0,
      shoesReceived: 0,
      carpetsReceived: 0,
      thirdPartyRevenue: 0,
      thirdPartyItems: 0,
    },
    reportGroups: [],
    spendingInsight: {
      expenseTotal: 0,
      serviceRevenue: 0,
      shoesProcessed: 0,
      carpetsProcessed: 0,
      itemsProcessed: 0,
    },
  };
}

function addRevenueToPeriod(period, revenue = 0, quantity = 0) {
  period.serviceRevenue += revenue;
  period.totalRevenue += revenue;
  period.netRevenue += revenue;
  period.itemsReceived += quantity;
}

function ensureReportGroup(reportGroups, group) {
  if (!reportGroups.has(group)) {
    reportGroups.set(group, {
      reportGroup: group,
      todayQuantity: 0,
      todayRevenue: 0,
      monthQuantity: 0,
      monthRevenue: 0,
      yearQuantity: 0,
      yearRevenue: 0,
      rangeQuantity: 0,
      rangeRevenue: 0,
    });
  }

  return reportGroups.get(group);
}

function addReportGroupTotals(reportGroups, group, rowDate, revenue, quantity, periods) {
  const currentGroup = ensureReportGroup(reportGroups, group);

  if (rowDate === periods.today) {
    currentGroup.todayQuantity += quantity;
    currentGroup.todayRevenue += revenue;
  }

  if (rowDate >= periods.monthStart) {
    currentGroup.monthQuantity += quantity;
    currentGroup.monthRevenue += revenue;
  }

  if (rowDate >= periods.selectedStart && rowDate <= periods.selectedEnd) {
    currentGroup.rangeQuantity += quantity;
    currentGroup.rangeRevenue += revenue;
  }

  currentGroup.yearQuantity += quantity;
  currentGroup.yearRevenue += revenue;
}

function mapPrepItem(item) {
  const visit = item.cleanstep_visits || {};

  return {
    id: item.id,
    customerName: visit.customer_name_snapshot || "Unknown customer",
    whatsAppNumber: formatWhatsAppNumber(visit.whatsapp_snapshot || ""),
    visitDate: visit.visit_date || "",
    serviceName: item.service_name_snapshot,
    quantity: Number(item.quantity || 0),
    unitLabel: item.unit_label_snapshot || "item",
    prepStatus: item.prep_status,
    prepDueAt: item.prep_due_at,
    deliveryStatus: item.delivery_status,
    thirdPartyPartner: item.third_party_partner || "",
    lineTotal: Number(item.line_total || 0),
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsvResponse(filename, headers, rows) {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function getManagementMonthMeta(dateString = "") {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const monthMeta = MANAGEMENT_MONTHS.find(
    (item) => item.year === year && item.month === month,
  );

  if (!monthMeta || !day) {
    return null;
  }

  return {
    ...monthMeta,
    day,
    rowNumber: 7 + day,
  };
}

function getManagementSheet(workbook, prefix, monthMeta) {
  const sheetPrefix = `${prefix} ${monthMeta.label} ${monthMeta.year}`;

  return workbook.worksheets.find((sheet) => sheet.name.startsWith(sheetPrefix)) || null;
}

function getEmptyWorkbookTotals() {
  return {
    footwear: 0,
    carpets: 0,
    upholstery: 0,
    print: 0,
    retail: 0,
    kitwe: 0,
    eldoraigne: 0,
  };
}

function ensureWorkbookDayTotals(totalsByDate, dateString) {
  if (!totalsByDate.has(dateString)) {
    totalsByDate.set(dateString, getEmptyWorkbookTotals());
  }

  return totalsByDate.get(dateString);
}

function getWorkbookServiceGroup(reportGroup = "") {
  const normalizedGroup = normalizeManagementReportGroup(reportGroup);

  if (normalizedGroup === "footwear" || normalizedGroup === "bags") {
    return "footwear";
  }

  if (normalizedGroup === "carpets") {
    return "carpets";
  }

  if (normalizedGroup === "upholstery") {
    return "upholstery";
  }

  return "";
}

function getWorkbookShopSaleGroup(row) {
  const group = getShopSaleReportGroup(row);

  return group === "print_copies" ? "print" : "retail";
}

function setWorkbookNumber(sheet, rowNumber, columnNumber, value) {
  const numericValue = Number(value || 0);
  sheet.getRow(rowNumber).getCell(columnNumber).value = numericValue > 0 ? numericValue : null;
}

function fillManagementWorkbook(workbook, totalsByDate) {
  totalsByDate.forEach((totals, dateString) => {
    const monthMeta = getManagementMonthMeta(dateString);

    if (!monthMeta) {
      return;
    }

    const shopSheet = getManagementSheet(workbook, "SHOP", monthMeta);
    const thirdPartySheet = getManagementSheet(workbook, "THIRD PARTY", monthMeta);

    if (shopSheet) {
      setWorkbookNumber(shopSheet, monthMeta.rowNumber, 3, totals.footwear);
      setWorkbookNumber(shopSheet, monthMeta.rowNumber, 4, totals.carpets);
      setWorkbookNumber(shopSheet, monthMeta.rowNumber, 5, totals.upholstery);
      setWorkbookNumber(shopSheet, monthMeta.rowNumber, 6, totals.print);
      setWorkbookNumber(shopSheet, monthMeta.rowNumber, 7, totals.retail);
    }

    if (thirdPartySheet) {
      setWorkbookNumber(thirdPartySheet, monthMeta.rowNumber, 3, totals.kitwe);
      setWorkbookNumber(thirdPartySheet, monthMeta.rowNumber, 4, totals.eldoraigne);
    }
  });
}

async function loadPagedRows(fetchPage) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const pageRows = data || [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function loadManagementWorkbookExport(supabase) {
  const [serviceItems, shopSales] = await Promise.all([
    loadPagedRows((from, to) =>
      supabase
        .from("cleanstep_visit_items")
        .select(
          "report_group_snapshot, line_total, third_party_partner, cleanstep_visits!inner(visit_date, status)",
        )
        .gte("cleanstep_visits.visit_date", MANAGEMENT_REPORT_START_DATE)
        .lte("cleanstep_visits.visit_date", MANAGEMENT_REPORT_END_DATE)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    loadPagedRows((from, to) =>
      supabase
        .from("daily_finance_sales")
        .select("sale_date, category, product_name, total")
        .gte("sale_date", MANAGEMENT_REPORT_START_DATE)
        .lte("sale_date", MANAGEMENT_REPORT_END_DATE)
        .order("sale_date", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);
  const totalsByDate = new Map();

  serviceItems.forEach((item) => {
    const visit = Array.isArray(item.cleanstep_visits)
      ? item.cleanstep_visits[0]
      : item.cleanstep_visits;
    const visitDate = visit?.visit_date || "";

    if (!visitDate || visit.status === "cancelled") {
      return;
    }

    const dayTotals = ensureWorkbookDayTotals(totalsByDate, visitDate);
    const amount = Number(item.line_total || 0);
    const partner = String(item.third_party_partner || "").toLowerCase();

    if (partner.includes("kitwe")) {
      dayTotals.kitwe += amount;
      return;
    }

    if (partner.includes("eldo")) {
      dayTotals.eldoraigne += amount;
      return;
    }

    const workbookGroup = getWorkbookServiceGroup(item.report_group_snapshot);

    if (workbookGroup) {
      dayTotals[workbookGroup] += amount;
    }
  });

  shopSales.forEach((sale) => {
    const saleDate = sale.sale_date || "";

    if (!saleDate) {
      return;
    }

    const dayTotals = ensureWorkbookDayTotals(totalsByDate, saleDate);
    const workbookGroup = getWorkbookShopSaleGroup(sale);
    dayTotals[workbookGroup] += Number(sale.total || 0);
  });

  const templateBuffer = await fs.readFile(MANAGEMENT_TEMPLATE_PATH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  workbook.calcProperties.fullCalcOnLoad = true;
  fillManagementWorkbook(workbook, totalsByDate);

  const outputBuffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(outputBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="cleanstep-management-report-2026-2027.xlsx"',
    },
  });
}

function mapVisitItemExportRow(item) {
  const visit = item.cleanstep_visits || {};

  return {
    visit_date: visit.visit_date || "",
    customer_name: visit.customer_name_snapshot || "",
    whatsapp_number: formatWhatsAppNumber(visit.whatsapp_snapshot || ""),
    visit_status: visit.status || "",
    payment_method: visit.payment_method || "",
    service_name: item.service_name_snapshot || "",
    report_group: item.report_group_snapshot || "",
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    line_total: Number(item.line_total || 0),
    third_party_partner: item.third_party_partner || "",
    prep_status: item.prep_status || "",
    prep_due_at: item.prep_due_at || "",
    delivery_status: item.delivery_status || "",
    visit_total: Number(visit.total || 0),
    notes: item.notes || visit.notes || "",
    created_at: item.created_at || "",
  };
}

async function loadManagementExport(supabase, exportType) {
  if (exportType === "management-workbook") {
    return loadManagementWorkbookExport(supabase);
  }

  if (exportType === "expenses") {
    const { data, error } = await supabase
      .from("cleanstep_expenses")
      .select("expense_date, description, category, quantity, amount, recorded_by, notes, created_at")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      throw error;
    }

    return buildCsvResponse(
      `cleanstep-expenses-${getJohannesburgDateString()}.csv`,
      ["expense_date", "description", "category", "quantity", "amount", "recorded_by", "notes", "created_at"],
      data || [],
    );
  }

  if (exportType === "daily-summary") {
    const { data, error } = await supabase
      .from("cleanstep_service_revenue_daily")
      .select("visit_date, report_group, visit_count, line_item_count, total_quantity, total_revenue")
      .order("visit_date", { ascending: false })
      .limit(5000);

    if (error) {
      throw error;
    }

    return buildCsvResponse(
      `cleanstep-management-summary-${getJohannesburgDateString()}.csv`,
      ["visit_date", "report_group", "visit_count", "line_item_count", "total_quantity", "total_revenue"],
      data || [],
    );
  }

  let query = supabase
    .from("cleanstep_visit_items")
    .select(
      "id, service_name_snapshot, report_group_snapshot, quantity, unit_price, line_total, third_party_partner, prep_status, prep_due_at, delivery_status, notes, created_at, cleanstep_visits(customer_name_snapshot, whatsapp_snapshot, visit_date, status, payment_method, total, notes)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (exportType === "prep") {
    query = query.neq("prep_status", "ready");
  }

  if (exportType === "deliveries") {
    query = query.not("third_party_partner", "is", null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const filename =
    exportType === "prep"
      ? "cleanstep-prep-queue"
      : exportType === "deliveries"
        ? "cleanstep-third-party-deliveries"
        : "cleanstep-service-visits";

  return buildCsvResponse(
    `${filename}-${getJohannesburgDateString()}.csv`,
    [
      "visit_date",
      "customer_name",
      "whatsapp_number",
      "visit_status",
      "payment_method",
      "service_name",
      "report_group",
      "quantity",
      "unit_price",
      "line_total",
      "third_party_partner",
      "prep_status",
      "prep_due_at",
      "delivery_status",
      "visit_total",
      "notes",
      "created_at",
    ],
    (data || []).map(mapVisitItemExportRow),
  );
}

async function loadCustomers(supabase) {
  const { data, error } = await supabase
    .from("loyalty_customers")
    .select("id, customer_name, whatsapp_number")
    .order("customer_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(mapCustomer);
}

async function loadManagementData(supabase) {
  const [categoriesResult, servicesResult, visitsResult, summaryResult] = await Promise.all([
    supabase
      .from("cleanstep_service_categories")
      .select("id, code, name, report_group, display_order, active")
      .eq("active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("cleanstep_services")
      .select(
        "id, code, name, pricing_type, default_unit_price, unit_label, loyalty_eligible, allow_price_override, notes, sort_order, cleanstep_service_categories(id, code, name, report_group)",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("cleanstep_visits")
      .select(
        "id, customer_name_snapshot, whatsapp_snapshot, visit_date, status, payment_method, total, amount_paid, notes, created_at, cleanstep_visit_items(id, service_name_snapshot, report_group_snapshot, quantity, unit_price, line_total, third_party_partner, prep_status, prep_due_at, delivery_status)",
      )
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("cleanstep_service_revenue_daily")
      .select("visit_date, report_group, total_quantity, total_revenue")
      .order("visit_date", { ascending: false })
      .limit(40),
  ]);

  const error =
    categoriesResult.error ||
    servicesResult.error ||
    visitsResult.error ||
    summaryResult.error;

  if (error) {
    throw error;
  }

  return {
    categories: categoriesResult.data || [],
    services: (servicesResult.data || []).map(mapService),
    recentVisits: (visitsResult.data || []).map(mapVisit),
    dailySummary: (summaryResult.data || []).map((row) => ({
      visitDate: row.visit_date,
      reportGroup: row.report_group,
      totalQuantity: Number(row.total_quantity || 0),
      totalRevenue: Number(row.total_revenue || 0),
    })),
  };
}

async function loadOwnerDashboardData(supabase, reportRange = null) {
  const today = getJohannesburgDateString();
  const { monthStart, yearStart } = getPeriodStarts(today);
  const selectedRange = reportRange || { startDate: today, endDate: today, label: "Today" };
  const ownerSummary = getEmptyOwnerSummary();
  ownerSummary.selectedRange = {
    ...ownerSummary.selectedRange,
    label: selectedRange.label,
    startDate: selectedRange.startDate,
    endDate: selectedRange.endDate,
  };

  const [
    serviceSummaryResult,
    shopSalesResult,
    expensesResult,
    topCustomersResult,
    prepItemsResult,
    prepProgressResult,
    deliveryItemsResult,
    thirdPartySalesResult,
  ] = await Promise.all([
    supabase
      .from("cleanstep_service_revenue_daily")
      .select("visit_date, report_group, total_quantity, total_revenue")
      .gte("visit_date", yearStart)
      .order("visit_date", { ascending: false }),
    supabase
      .from("daily_finance_sales")
      .select("sale_date, product_name, category, quantity, total")
      .gte("sale_date", yearStart),
    supabase
      .from("cleanstep_expense_daily_totals")
      .select("expense_date, category, total_quantity, total_spent")
      .gte("expense_date", yearStart)
      .order("expense_date", { ascending: false }),
    supabase
      .from("cleanstep_customer_value")
      .select(
        "customer_id, customer_name, whatsapp_number, total_visits, total_spent, total_shoes, total_carpets, first_visit_date, most_recent_visit_date",
      )
      .order("total_spent", { ascending: false })
      .limit(8),
    supabase
      .from("cleanstep_visit_items")
      .select(
        "id, service_name_snapshot, quantity, unit_label_snapshot, prep_status, prep_due_at, delivery_status, third_party_partner, line_total, cleanstep_visits(customer_name_snapshot, whatsapp_snapshot, visit_date, status)",
      )
      .neq("prep_status", "ready")
      .order("prep_due_at", { ascending: true })
      .limit(12),
    supabase
      .from("cleanstep_visit_items")
      .select("id, prep_status, prep_due_at, cleanstep_visits(status)")
      .not("prep_due_at", "is", null)
      .gte("prep_due_at", `${today}T00:00:00.000+02:00`)
      .lt("prep_due_at", `${addDaysToDateString(today, 1)}T00:00:00.000+02:00`)
      .limit(1000),
    supabase
      .from("cleanstep_visit_items")
      .select(
        "id, service_name_snapshot, quantity, unit_label_snapshot, prep_status, prep_due_at, delivery_status, third_party_partner, line_total, cleanstep_visits(customer_name_snapshot, whatsapp_snapshot, visit_date, status)",
      )
      .eq("delivery_status", "required")
      .order("prep_due_at", { ascending: true })
      .limit(12),
    supabase
      .from("cleanstep_visit_items")
      .select("quantity, line_total, third_party_partner, cleanstep_visits(visit_date, status)")
      .not("third_party_partner", "is", null)
      .limit(1000),
  ]);

  const error =
    serviceSummaryResult.error ||
    shopSalesResult.error ||
    expensesResult.error ||
    topCustomersResult.error ||
    prepItemsResult.error ||
    prepProgressResult.error ||
    deliveryItemsResult.error ||
    thirdPartySalesResult.error;

  if (error) {
    throw error;
  }

  const reportGroups = new Map();

  (serviceSummaryResult.data || []).forEach((row) => {
    const revenue = Number(row.total_revenue || 0);
    const quantity = Number(row.total_quantity || 0);
    const group = normalizeManagementReportGroup(row.report_group);

    if (row.visit_date === today) {
      addRevenueToPeriod(ownerSummary.today, revenue, quantity);

      if (group === "footwear") {
        ownerSummary.today.shoesReceived += quantity;
      }

      if (group === "carpets") {
        ownerSummary.today.carpetsReceived += quantity;
      }

    }

    if (row.visit_date >= selectedRange.startDate && row.visit_date <= selectedRange.endDate) {
      addRevenueToPeriod(ownerSummary.selectedRange, revenue, quantity);

      if (group === "footwear") {
        ownerSummary.selectedRange.shoesReceived += quantity;
      }

      if (group === "carpets") {
        ownerSummary.selectedRange.carpetsReceived += quantity;
      }
    }

    if (row.visit_date >= monthStart) {
      addRevenueToPeriod(ownerSummary.month, revenue, quantity);
    }

    addRevenueToPeriod(ownerSummary.yearToDate, revenue, quantity);

    addReportGroupTotals(reportGroups, group, row.visit_date, revenue, quantity, {
      today,
      monthStart,
      selectedStart: selectedRange.startDate,
      selectedEnd: selectedRange.endDate,
    });
  });

  (shopSalesResult.data || []).forEach((row) => {
    const revenue = Number(row.total || 0);
    const quantity = Number(row.quantity || 0);
    const group = getShopSaleReportGroup(row);

    if (row.sale_date === today) {
      ownerSummary.today.shopRevenue += revenue;
      ownerSummary.today.totalRevenue += revenue;
      ownerSummary.today.netRevenue += revenue;
    }

    if (row.sale_date >= selectedRange.startDate && row.sale_date <= selectedRange.endDate) {
      ownerSummary.selectedRange.shopRevenue += revenue;
      ownerSummary.selectedRange.totalRevenue += revenue;
      ownerSummary.selectedRange.netRevenue += revenue;
    }

    if (row.sale_date >= monthStart) {
      ownerSummary.month.shopRevenue += revenue;
      ownerSummary.month.totalRevenue += revenue;
      ownerSummary.month.netRevenue += revenue;
    }

    ownerSummary.yearToDate.shopRevenue += revenue;
    ownerSummary.yearToDate.totalRevenue += revenue;
    ownerSummary.yearToDate.netRevenue += revenue;

    addReportGroupTotals(reportGroups, group, row.sale_date, revenue, quantity, {
      today,
      monthStart,
      selectedStart: selectedRange.startDate,
      selectedEnd: selectedRange.endDate,
    });
  });

  (expensesResult.data || []).forEach((row) => {
    const expense = Number(row.total_spent || 0);

    if (row.expense_date === today) {
      ownerSummary.today.expenses += expense;
      ownerSummary.today.netRevenue -= expense;
    }

    if (row.expense_date >= selectedRange.startDate && row.expense_date <= selectedRange.endDate) {
      ownerSummary.selectedRange.expenses += expense;
      ownerSummary.selectedRange.netRevenue -= expense;
    }

    if (row.expense_date >= monthStart) {
      ownerSummary.month.expenses += expense;
      ownerSummary.month.netRevenue -= expense;
    }

    ownerSummary.yearToDate.expenses += expense;
    ownerSummary.yearToDate.netRevenue -= expense;
  });

  (thirdPartySalesResult.data || []).forEach((row) => {
    const visitDate = row.cleanstep_visits?.visit_date || "";
    const visitStatus = row.cleanstep_visits?.status || "";

    if (!visitDate || visitStatus === "cancelled") {
      return;
    }

    const revenue = Number(row.line_total || 0);
    const quantity = Number(row.quantity || 0);

    if (visitDate === today) {
      ownerSummary.today.thirdPartyRevenue += revenue;
      ownerSummary.today.thirdPartyItems += quantity;
    }

    if (visitDate >= selectedRange.startDate && visitDate <= selectedRange.endDate) {
      ownerSummary.selectedRange.thirdPartyRevenue += revenue;
      ownerSummary.selectedRange.thirdPartyItems += quantity;
    }
  });

  ownerSummary.spendingInsight = {
    expenseTotal: ownerSummary.selectedRange.expenses,
    serviceRevenue: ownerSummary.selectedRange.serviceRevenue,
    shoesProcessed: ownerSummary.selectedRange.shoesReceived,
    carpetsProcessed: ownerSummary.selectedRange.carpetsReceived,
    itemsProcessed: ownerSummary.selectedRange.itemsReceived,
  };

  const prepItems = (prepItemsResult.data || []).map(mapPrepItem);
  const deliveryItems = (deliveryItemsResult.data || []).map(mapPrepItem);
  const prepDueTodayRows = (prepProgressResult.data || []).filter((item) => {
    const visitStatus = item.cleanstep_visits?.status || "";

    return visitStatus !== "cancelled" && item.prep_due_at !== null;
  });
  const prepDueTodayReady = prepDueTodayRows.filter((item) => item.prep_status === "ready").length;

  ownerSummary.today.jobsDueToday = prepItems.filter(
    (item) => item.prepDueAt && item.prepDueAt.slice(0, 10) === today,
  ).length;
  ownerSummary.today.overdueJobs = prepItems.filter(
    (item) => item.prepDueAt && item.prepDueAt.slice(0, 10) < today,
  ).length;
  ownerSummary.today.dueTodayTotal = prepDueTodayRows.length;
  ownerSummary.today.dueTodayReady = prepDueTodayReady;
  ownerSummary.today.dueTodayRemaining = Math.max(0, prepDueTodayRows.length - prepDueTodayReady);
  ownerSummary.today.dueTodayPercentage = prepDueTodayRows.length
    ? Math.round((prepDueTodayReady / prepDueTodayRows.length) * 100)
    : 0;
  ownerSummary.today.outstandingDeliveries = deliveryItems.length;
  ownerSummary.reportGroups = Array.from(reportGroups.values()).sort((a, b) =>
    a.reportGroup.localeCompare(b.reportGroup),
  );

  return {
    ownerSummary,
    topCustomers: (topCustomersResult.data || []).map((customer) => ({
      customerId: customer.customer_id,
      customerName: customer.customer_name,
      whatsAppNumber: formatWhatsAppNumber(customer.whatsapp_number),
      totalVisits: Number(customer.total_visits || 0),
      totalSpent: Number(customer.total_spent || 0),
      totalShoes: Number(customer.total_shoes || 0),
      totalCarpets: Number(customer.total_carpets || 0),
      firstVisitDate: customer.first_visit_date || "",
      mostRecentVisitDate: customer.most_recent_visit_date || "",
    })),
    prepItems,
    deliveryItems,
  };
}

async function findOrCreateCustomer(supabase, customerName, whatsAppNumber) {
  const { data: existingCustomer, error: lookupError } = await supabase
    .from("loyalty_customers")
    .select("id, customer_name, whatsapp_number")
    .eq("whatsapp_number", whatsAppNumber)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingCustomer) {
    if (existingCustomer.customer_name !== customerName) {
      const { error: updateError } = await supabase
        .from("loyalty_customers")
        .update({
          customer_name: customerName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCustomer.id);

      if (updateError) {
        throw updateError;
      }
    }

    return existingCustomer.id;
  }

  const { data: insertedCustomer, error: insertError } = await supabase
    .from("loyalty_customers")
    .insert({
      customer_name: customerName,
      whatsapp_number: whatsAppNumber,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedCustomer.id;
}

async function loadServicesById(supabase, serviceIds) {
  const { data, error } = await supabase
    .from("cleanstep_services")
    .select(
      "id, code, name, pricing_type, default_unit_price, unit_label, loyalty_eligible, cleanstep_service_categories(code, name, report_group)",
    )
    .in("id", serviceIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((service) => [service.id, service]));
}

async function saveLoyaltyMirrorVisit(supabase, customerId, visitDate, visitItems, visitId) {
  const qualifyingItems = visitItems.filter((item) => item.loyaltyEligible);
  const shoeQuantity = qualifyingItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!isQualifyingLoyaltyVisit(shoeQuantity)) {
    return null;
  }

  const shoeType = qualifyingItems
    .map((item) =>
      item.quantity > 1
        ? `${item.serviceName} - ${item.categoryName} x${item.quantity}`
        : `${item.serviceName} - ${item.categoryName}`,
    )
    .join(" | ");

  const { data, error } = await supabase
    .from("loyalty_visits")
    .insert({
      customer_id: customerId,
      shoe_type: shoeType,
      quantity: shoeQuantity,
      visit_date: visitDate,
      receipt_number: `service-${String(visitId).slice(0, 8)}`,
      notes: "Created from CleanStep service visit.",
    })
    .select("id, quantity")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    quantity: data.quantity,
    points: getLoyaltyVisitPoints(data.quantity),
  };
}

async function saveExpenseRecord(supabase, body) {
  const expenseDate = body.expenseDate || getJohannesburgDateString();
  const description = body.description?.trim();
  const category = body.category?.trim() || "other";
  const quantity = Math.max(1, Number(body.quantity) || 1);
  const amount = Math.max(0, Number(body.amount) || 0);
  const notes = body.notes?.trim() || null;

  if (!description || amount <= 0) {
    return NextResponse.json(
      {
        saved: false,
        message: "Expense description and amount are required.",
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("cleanstep_expenses")
    .insert({
      expense_date: expenseDate,
      description,
      category,
      quantity,
      amount,
      notes,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return NextResponse.json({
    saved: true,
    message: "Business expense recorded successfully.",
    expenseId: data.id,
  });
}

async function updateServicePrice(supabase, body) {
  const serviceId = body.serviceId?.trim();
  const defaultUnitPrice =
    body.defaultUnitPrice === "" || body.defaultUnitPrice === null
      ? null
      : Math.max(0, Number(body.defaultUnitPrice) || 0);
  const allowPriceOverride = Boolean(body.allowPriceOverride);
  const active = body.active !== false;
  const loyaltyEligible = Boolean(body.loyaltyEligible);

  if (!serviceId) {
    return NextResponse.json(
      {
        saved: false,
        message: "Choose the service you want to update first.",
      },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("cleanstep_services")
    .update({
      default_unit_price: defaultUnitPrice,
      allow_price_override: allowPriceOverride,
      active,
      loyalty_eligible: loyaltyEligible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", serviceId);

  if (error) {
    throw error;
  }

  return NextResponse.json({
    saved: true,
    message: "Service price settings updated successfully.",
  });
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        configured: true,
        schemaReady: true,
        message: "Admin sign-in is required.",
        categories: [],
        services: [],
        customers: [],
        recentVisits: [],
        dailySummary: [],
        ownerSummary: getEmptyOwnerSummary(),
        topCustomers: [],
        prepItems: [],
        deliveryItems: [],
      },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      schemaReady: false,
      message:
        "Supabase admin access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable service visits.",
      categories: [],
      services: [],
      customers: [],
      recentVisits: [],
      dailySummary: [],
      ownerSummary: getEmptyOwnerSummary(),
      topCustomers: [],
      prepItems: [],
      deliveryItems: [],
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("export");

    if (exportType) {
      return await loadManagementExport(supabase, exportType);
    }

    const reportRange = getReportRange(searchParams);
    const [customers, managementData, ownerDashboardData] = await Promise.all([
      loadCustomers(supabase),
      loadManagementData(supabase),
      loadOwnerDashboardData(supabase, reportRange),
    ]);

    return NextResponse.json({
      configured: true,
      schemaReady: true,
      message: "",
      customers,
      ...managementData,
      ...ownerDashboardData,
    });
  } catch (error) {
    if (isMissingManagementSchema(error)) {
      const customers = await loadCustomers(supabase).catch(() => []);

      return NextResponse.json({
        configured: true,
        schemaReady: false,
        message:
          "CleanStep management tables are not created yet. Run supabase/cleanstep-management.sql in the Supabase SQL Editor.",
        categories: [],
        services: [],
        customers,
        recentVisits: [],
        dailySummary: [],
        ownerSummary: getEmptyOwnerSummary(),
        topCustomers: [],
        prepItems: [],
        deliveryItems: [],
      });
    }

    return NextResponse.json(
      {
        configured: true,
        schemaReady: true,
        message: error.message || "Unable to load CleanStep management data.",
        categories: [],
        services: [],
        customers: [],
        recentVisits: [],
        dailySummary: [],
        ownerSummary: getEmptyOwnerSummary(),
        topCustomers: [],
        prepItems: [],
        deliveryItems: [],
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
          "Supabase admin access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save service visits.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "recordExpense") {
      return await saveExpenseRecord(supabase, body);
    }

    const customerName = body.customerName?.trim();
    const whatsAppNumber = normalizeWhatsAppNumber(body.whatsAppNumber);
    const visitDate = body.visitDate;
    const paymentMethod = body.paymentMethod || "unpaid";
    const recordType = body.recordType === "third_party" ? "third_party" : "client";
    const visitThirdPartyPartner = body.thirdPartyPartner || null;
    const notes = body.notes?.trim() || null;
    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !whatsAppNumber || !visitDate || rawItems.length === 0) {
      return NextResponse.json(
        {
          saved: false,
          message: "Customer, WhatsApp number, visit date, and at least one service item are required.",
        },
        { status: 400 },
      );
    }

    if (
      recordType === "third_party" &&
      !["Eldoraigne", "Kitwe"].includes(visitThirdPartyPartner)
    ) {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose Eldoraigne or Kitwe before saving a third-party record.",
        },
        { status: 400 },
      );
    }

    if (!["cash", "card", "mixed", "unpaid"].includes(paymentMethod)) {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose cash, card, mixed, or unpaid as the payment method.",
        },
        { status: 400 },
      );
    }

    const serviceIds = [...new Set(rawItems.map((item) => item.serviceId).filter(Boolean))];
    const servicesById = await loadServicesById(supabase, serviceIds);

    if (servicesById.size !== serviceIds.length) {
      return NextResponse.json(
        {
          saved: false,
          message: "One of the selected services could not be found. Refresh and try again.",
        },
        { status: 400 },
      );
    }

    const visitItems = rawItems.map((item) => {
      const service = servicesById.get(item.serviceId);
      const category = service.cleanstep_service_categories || {};
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const thirdPartyPartner =
        recordType === "third_party" ? visitThirdPartyPartner : item.thirdPartyPartner || null;

      if (!quantity) {
        throw new Error("Every service item needs a quantity greater than zero.");
      }

      if (thirdPartyPartner && !["Eldoraigne", "Kitwe"].includes(thirdPartyPartner)) {
        throw new Error("Third-party partner must be Eldoraigne or Kitwe.");
      }

      return {
        serviceId: service.id,
        categoryCode: category.code,
        categoryName: category.name,
        reportGroup: category.report_group,
        serviceCode: service.code,
        serviceName: service.name,
        pricingType: service.pricing_type,
        unitLabel: service.unit_label,
        quantity,
        unitPrice,
        loyaltyEligible: Boolean(service.loyalty_eligible),
        thirdPartyPartner,
        notes: item.notes?.trim() || null,
      };
    });

    const total = visitItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const customerId = await findOrCreateCustomer(supabase, customerName, whatsAppNumber);

    const { data: savedVisit, error: visitError } = await supabase
      .from("cleanstep_visits")
      .insert({
        customer_id: customerId,
        customer_name_snapshot: customerName,
        whatsapp_snapshot: whatsAppNumber,
        source: "admin",
        status: paymentMethod === "unpaid" ? "received" : "completed",
        received_at: receivedAt.toISOString(),
        visit_date: visitDate,
        payment_method: paymentMethod,
        subtotal: total,
        discount_total: 0,
        total,
        amount_paid: paymentMethod === "unpaid" ? 0 : total,
        notes,
        completed_at: paymentMethod === "unpaid" ? null : new Date().toISOString(),
      })
      .select("id")
      .single();

    if (visitError) {
      throw visitError;
    }

    const prepDueAt = getPrepDueAtForVisitDate(visitDate);
    const itemRows = visitItems.map((item) => ({
      visit_id: savedVisit.id,
      service_id: item.serviceId,
      category_code_snapshot: item.categoryCode,
      report_group_snapshot: item.reportGroup,
      service_code_snapshot: item.serviceCode,
      service_name_snapshot: item.serviceName,
      pricing_type_snapshot: item.pricingType,
      unit_label_snapshot: item.unitLabel,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      loyalty_eligible_snapshot: item.loyaltyEligible,
      third_party_partner: item.thirdPartyPartner,
      prep_status: "waiting",
      prep_due_at: prepDueAt,
      delivery_status: item.thirdPartyPartner ? "required" : "not_required",
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase
      .from("cleanstep_visit_items")
      .insert(itemRows);

    if (itemsError) {
      throw itemsError;
    }

    const loyaltyMirror = await saveLoyaltyMirrorVisit(
      supabase,
      customerId,
      visitDate,
      visitItems,
      savedVisit.id,
    );

    return NextResponse.json({
      saved: true,
      message: "CleanStep service visit saved successfully.",
      visitId: savedVisit.id,
      total,
      loyaltyMirror,
    });
  } catch (error) {
    const missingSchema = isMissingManagementSchema(error);

    return NextResponse.json(
      {
        saved: false,
        message: missingSchema
          ? "CleanStep management tables are not created yet. Run supabase/cleanstep-management.sql in the Supabase SQL Editor."
          : error.message || "Unable to save the CleanStep service visit.",
      },
      { status: missingSchema ? 400 : 500 },
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
          "Supabase admin access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to update service items.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const action = body.action;
    const itemId = body.itemId?.trim();

    if (action === "updateServicePrice") {
      return await updateServicePrice(supabase, body);
    }

    if (!itemId) {
      return NextResponse.json(
        {
          saved: false,
          message: "Choose the item you want to update first.",
        },
        { status: 400 },
      );
    }

    if (action === "markReady") {
      const { error } = await supabase
        .from("cleanstep_visit_items")
        .update({
          prep_status: "ready",
          ready_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        saved: true,
        message: "Prep item marked ready.",
      });
    }

    if (action === "markDelivered") {
      const { error } = await supabase
        .from("cleanstep_visit_items")
        .update({
          delivery_status: "delivered",
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .not("third_party_partner", "is", null);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        saved: true,
        message: "Third-party delivery marked delivered.",
      });
    }

    return NextResponse.json(
      {
        saved: false,
        message: "Choose a supported management action first.",
      },
      { status: 400 },
    );
  } catch (error) {
    const missingSchema = isMissingManagementSchema(error);

    return NextResponse.json(
      {
        saved: false,
        message: missingSchema
          ? "CleanStep management tables are not created yet. Run supabase/cleanstep-management.sql in the Supabase SQL Editor."
          : error.message || "Unable to update the CleanStep service item.",
      },
      { status: missingSchema ? 400 : 500 },
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
          "Supabase admin access is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to delete service visits.",
      },
      { status: 500 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");

    if (!visitId) {
      return NextResponse.json(
        {
          deleted: false,
          message: "Choose the service visit you want to delete first.",
        },
        { status: 400 },
      );
    }

    const mirrorReceiptNumber = `service-${String(visitId).slice(0, 8)}`;
    await supabase.from("loyalty_visits").delete().eq("receipt_number", mirrorReceiptNumber);

    const { error } = await supabase
      .from("cleanstep_visits")
      .delete()
      .eq("id", visitId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      deleted: true,
      message: "Service visit deleted successfully.",
    });
  } catch (error) {
    const missingSchema = isMissingManagementSchema(error);

    return NextResponse.json(
      {
        deleted: false,
        message: missingSchema
          ? "CleanStep management tables are not created yet. Run supabase/cleanstep-management.sql in the Supabase SQL Editor."
          : error.message || "Unable to delete the CleanStep service visit.",
      },
      { status: missingSchema ? 400 : 500 },
    );
  }
}
