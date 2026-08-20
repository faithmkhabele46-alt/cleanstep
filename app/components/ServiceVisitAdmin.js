"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/booking";

const emptyVisitForm = {
  recordType: "client",
  thirdPartyPartner: "",
  customerName: "",
  whatsAppNumber: "",
  visitDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash",
  notes: "",
};

const emptyLineForm = {
  serviceGroup: "",
  categoryCode: "",
  serviceId: "",
  quantity: 1,
  unitPrice: "",
  thirdPartyPartner: "",
  notes: "",
};

const emptyExpenseForm = {
  expenseDate: new Date().toISOString().slice(0, 10),
  description: "",
  category: "supplies",
  quantity: 1,
  amount: "",
  notes: "",
};

const emptyPriceForm = {
  serviceId: "",
  defaultUnitPrice: "",
  allowPriceOverride: false,
  loyaltyEligible: false,
  active: true,
};

const defaultReportFilters = {
  preset: "today",
  date: new Date().toISOString().slice(0, 10),
  month: new Date().toISOString().slice(0, 7),
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
};

const SERVICE_GROUPS = [
  { value: "shoes", label: "Shoes" },
  { value: "carpets", label: "Carpets" },
  { value: "couches", label: "Couches" },
  { value: "bags", label: "Bags" },
  { value: "mattresses", label: "Mattress" },
];
const DISCOUNTED_THIRD_PARTY_PARTNERS = new Set(["Eldoraigne", "Clubview"]);
const DELIVERY_THIRD_PARTY_PARTNERS = new Set(["Eldoraigne", "Kitwe"]);
const THIRD_PARTY_PRICE_DISCOUNT = 10;

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function getServiceGroupForCategory(category = {}) {
  const code = category.code || "";
  const reportGroup = category.reportGroup || category.report_group || "";

  if (reportGroup === "footwear" || code.startsWith("footwear_")) {
    return "shoes";
  }

  if (reportGroup === "carpets" || code.startsWith("carpets_")) {
    return "carpets";
  }

  if (code === "couches") {
    return "couches";
  }

  if (code === "mattresses") {
    return "mattresses";
  }

  if (reportGroup === "bags" || code === "bags") {
    return "bags";
  }

  return "";
}

function formatNumber(value = 0) {
  const number = Number(value || 0);

  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toFixed(2).replace(/\.?0+$/, "");
}

function getReportGroupLabel(value = "") {
  const labels = {
    bags: "Bags",
    carpets: "Carpets",
    footwear: "Footwear",
    other_services: "Other Services",
    print_copies: "Print & Copies",
    print_retail: "Print & Retail",
    retail: "Retail",
    third_party: "Third Party",
    upholstery: "Upholstery",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isWholeQuantityService(service) {
  return service?.unitLabel !== "sqm";
}

function normalizeServiceQuantity(service, value) {
  if (value === "") {
    return "";
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  if (isWholeQuantityService(service)) {
    return String(Math.max(1, Math.ceil(number)));
  }

  return String(number);
}

function getThirdPartyUnitPrice(unitPrice, partner) {
  const number = Number(unitPrice || 0);

  if (DISCOUNTED_THIRD_PARTY_PARTNERS.has(partner)) {
    return Math.max(0, number - THIRD_PARTY_PRICE_DISCOUNT);
  }

  return number;
}

function getServiceDefaultUnitPrice(service, partner) {
  if (service?.defaultUnitPrice === null || service?.defaultUnitPrice === undefined) {
    return "";
  }

  return String(getThirdPartyUnitPrice(service.defaultUnitPrice, partner));
}

function getThirdPartyTaskLabel(partner = "") {
  return DELIVERY_THIRD_PARTY_PARTNERS.has(partner) ? "delivery" : "collection";
}

function buildLineItem(service, lineForm) {
  if (!service) {
    return null;
  }

  const quantity = Number(normalizeServiceQuantity(service, lineForm.quantity)) || 0;
  const unitPrice = Math.max(0, Number(lineForm.unitPrice) || 0);

  if (!quantity) {
    return null;
  }

  return {
    localId: `${service.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serviceId: service.id,
    serviceName: service.name,
    categoryName: service.category.name,
    reportGroup: service.category.reportGroup,
    pricingType: service.pricingType,
    unitLabel: service.unitLabel,
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
    loyaltyEligible: service.loyaltyEligible,
    thirdPartyPartner: lineForm.thirdPartyPartner,
    notes: lineForm.notes.trim(),
  };
}

function downloadManagementExport(exportType) {
  window.location.href = `/api/admin/management?export=${encodeURIComponent(exportType)}`;
}

function buildWhatsAppHref(number, item) {
  const digits = String(number || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const internationalNumber = digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  const message = `${item.customerName}, your ${formatNumber(item.quantity)} ${item.serviceName} ${
    Number(item.quantity) === 1 ? "is" : "are"
  } ready for collection at CleanStep.`;

  return `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`;
}

function getPrepTaskName(item) {
  return item.thirdPartyPartner || item.customerName;
}

function getPrepTaskDetail(item) {
  const quantityLabel = `${formatNumber(item.quantity)} ${item.serviceName}`;

  if (item.thirdPartyPartner === "Clubview") {
    return `${quantityLabel} - WhatsApp Clubview for collection`;
  }

  if (item.thirdPartyPartner) {
    return `${quantityLabel} - prepare for ${item.thirdPartyPartner} delivery`;
  }

  return `${quantityLabel} - due ${item.prepDueAt ? item.prepDueAt.slice(0, 10) : "not set"}`;
}

function RecentServiceVisitCard({ visit, onDeleteVisit, loadingAction }) {
  return (
    <div className="rounded-2xl border border-[#1f4b8f]/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#3f363a]">{visit.customerName}</p>
          <p className="mt-1 text-sm text-[#5c5357]">
            {visit.visitDate} - {visit.whatsAppNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-[#1f4b8f]">{formatCurrency(visit.total)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#7b7276]">
            {visit.paymentMethod || visit.status}
          </p>
          <button
            type="button"
            onClick={() => onDeleteVisit(visit)}
            disabled={loadingAction}
            className="mt-3 rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold text-[#e1251b] transition hover:bg-[#ffe7e4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete visit
          </button>
        </div>
      </div>
      {visit.items.length > 0 && (
        <div className="mt-3 space-y-2">
          {visit.items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[#1f4b8f]/8 bg-[#f8fbff] px-3 py-2 text-sm text-[#5c5357]"
            >
              <span className="font-semibold text-[#3f363a]">{item.serviceName}</span>
              {" - "}
              {formatNumber(item.quantity)} {item.unitLabel || "item"}
              {" - "}
              {formatCurrency(item.lineTotal)}
              {item.thirdPartyPartner ? ` - ${item.thirdPartyPartner}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value, tone = "blue" }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border p-4",
        tone === "red"
          ? "border-[#e1251b]/16 bg-[#fff3f2]"
          : "border-[#1f4b8f]/10 bg-[#f8fbff]",
      )}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">{label}</p>
      <p
        className={classNames(
          "mt-2 text-2xl font-semibold",
          tone === "red" ? "text-[#e1251b]" : "text-[#1f4b8f]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OwnerDashboardPanel({
  ownerSummary,
  services,
  topCustomers,
  prepItems,
  deliveryItems,
  reportFilters,
  priceForm,
  priceState,
  expenseForm,
  expenseState,
  actionState,
  onReportFilterChange,
  onReportRefresh,
  onPriceChange,
  onPriceSubmit,
  onExpenseChange,
  onExpenseSubmit,
  onMarkReady,
  onMarkDelivered,
}) {
  const summary = ownerSummary || {};
  const today = summary.today || {};
  const month = summary.month || {};
  const yearToDate = summary.yearToDate || {};
  const selectedRange = summary.selectedRange || {};
  const spendingInsight = summary.spendingInsight || {};
  const reportGroups = summary.reportGroups || [];
  const todayDate = new Date().toISOString().slice(0, 10);
  const urgentPrepItems = prepItems.filter(
    (item) => item.prepDueAt && item.prepDueAt.slice(0, 10) <= todayDate,
  );
  const taskProgressPercent = Math.max(0, Math.min(100, Number(today.dueTodayPercentage || 0)));

  return (
    <div className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Owner dashboard</p>
          <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">Today at CleanStep</h2>
        </div>
        <div className="hidden rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Today net</p>
          <p className="mt-1 text-xl font-semibold text-[#1f4b8f]">
            {formatCurrency(today.netRevenue || 0)}
          </p>
        </div>
      </div>

      {urgentPrepItems.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#e1251b]">Ready follow-up needed</p>
          <p className="mt-2 text-sm font-semibold text-[#3f363a]">
            {urgentPrepItems[0].customerName} has {formatNumber(urgentPrepItems[0].quantity)}{" "}
            {urgentPrepItems[0].serviceName} due now.
          </p>
          <p className="mt-1 text-sm text-[#7c4642]">
            Mark the task ready when it is prepared, then WhatsApp the customer from the task list.
          </p>
        </div>
      )}

      <div className="hidden mt-5 rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1fr_1fr_1fr_auto]">
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="reportPreset">
              Report range
            </label>
            <select
              id="reportPreset"
              value={reportFilters.preset}
              onChange={(event) => onReportFilterChange("preset", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this-week">This week</option>
              <option value="selected-date">Selected date</option>
              <option value="selected-month">Selected month</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="reportDate">
              Date
            </label>
            <input
              id="reportDate"
              type="date"
              value={reportFilters.date}
              onChange={(event) => onReportFilterChange("date", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="reportMonth">
              Month
            </label>
            <input
              id="reportMonth"
              type="month"
              value={reportFilters.month}
              onChange={(event) => onReportFilterChange("month", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-[#3f363a]" htmlFor="reportStart">
                Start
              </label>
              <input
                id="reportStart"
                type="date"
                value={reportFilters.startDate}
                onChange={(event) => onReportFilterChange("startDate", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#3f363a]" htmlFor="reportEnd">
                End
              </label>
              <input
                id="reportEnd"
                type="date"
                value={reportFilters.endDate}
                onChange={(event) => onReportFilterChange("endDate", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onReportRefresh}
              className="w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#173a70]"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="hidden mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Total revenue" value={formatCurrency(today.totalRevenue || 0)} />
        <MetricTile label="Service revenue" value={formatCurrency(today.serviceRevenue || 0)} />
        <MetricTile label="Shop revenue" value={formatCurrency(today.shopRevenue || 0)} />
        <MetricTile label="Expenses" value={formatCurrency(today.expenses || 0)} tone="red" />
        <MetricTile label="Items received" value={formatNumber(today.itemsReceived || 0)} />
        <MetricTile label="Shoes" value={formatNumber(today.shoesReceived || 0)} />
        <MetricTile label="Carpets" value={formatNumber(today.carpetsReceived || 0)} />
        <MetricTile label="Third-party" value={formatCurrency(today.thirdPartyRevenue || 0)} />
        <MetricTile label="Deliveries" value={formatNumber(today.outstandingDeliveries || 0)} tone="red" />
      </div>

      <div className="mt-5 grid gap-4">
        <div className="hidden rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Management report</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadManagementExport("daily-summary")}
                className="rounded-full border border-[#1f4b8f]/12 bg-white px-3 py-2 text-xs font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
              >
                Summary CSV
              </button>
              <button
                type="button"
                onClick={() => downloadManagementExport("service-visits")}
                className="rounded-full border border-[#1f4b8f]/12 bg-white px-3 py-2 text-xs font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
              >
                Visits CSV
              </button>
              <button
                type="button"
                onClick={() => downloadManagementExport("expenses")}
                className="rounded-full border border-[#1f4b8f]/12 bg-white px-3 py-2 text-xs font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
              >
                Expenses CSV
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricTile
              label={`${selectedRange.label || "Selected"} revenue`}
              value={formatCurrency(selectedRange.totalRevenue || 0)}
            />
            <MetricTile
              label={`${selectedRange.label || "Selected"} net`}
              value={formatCurrency(selectedRange.netRevenue || 0)}
            />
            <MetricTile label="Month revenue" value={formatCurrency(month.totalRevenue || 0)} />
            <MetricTile label="Month net" value={formatCurrency(month.netRevenue || 0)} />
            <MetricTile label="Financial YTD revenue" value={formatCurrency(yearToDate.totalRevenue || 0)} />
            <MetricTile label="Financial YTD net" value={formatCurrency(yearToDate.netRevenue || 0)} />
          </div>
          <div className="mt-4 rounded-2xl border border-[#1f4b8f]/8 bg-white p-4 text-sm text-[#5c5357]">
            <p className="font-semibold text-[#3f363a]">Track spending insight</p>
            <p className="mt-2">
              Spending: {formatCurrency(spendingInsight.expenseTotal || 0)} - Service revenue:{" "}
              {formatCurrency(spendingInsight.serviceRevenue || 0)}
            </p>
            <p className="mt-1">
              Activity: {formatNumber(spendingInsight.shoesProcessed || 0)} shoes,{" "}
              {formatNumber(spendingInsight.carpetsProcessed || 0)} carpets,{" "}
              {formatNumber(spendingInsight.itemsProcessed || 0)} total service items.
            </p>
          </div>
          {reportGroups.length > 0 ? (
            <div className="mt-4 space-y-2">
              {reportGroups.map((group) => (
                <div
                  key={group.reportGroup}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#1f4b8f]/8 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#3f363a]">
                      {getReportGroupLabel(group.reportGroup)}
                    </p>
                    <p className="mt-1 text-[#7b7276]">
                      Today: {formatNumber(group.todayQuantity)} item{group.todayQuantity === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-[#7b7276]">
                      Range: {formatNumber(group.rangeQuantity)} item{group.rangeQuantity === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1f4b8f]">
                      {formatCurrency(group.todayRevenue)}
                    </p>
                    <p className="mt-1 text-[#7b7276]">
                      Range: {formatCurrency(group.rangeRevenue)}
                    </p>
                    <p className="mt-1 text-[#7b7276]">
                      Month: {formatCurrency(group.monthRevenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#7b7276]">
              No service revenue recorded yet.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">48-hour prep</p>
              <button
                type="button"
                onClick={() => downloadManagementExport("prep")}
                className="rounded-full border border-[#1f4b8f]/12 bg-white px-3 py-2 text-xs font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
              >
                Prep CSV
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Due today" value={formatNumber(today.jobsDueToday || 0)} />
              <MetricTile label="Overdue" value={formatNumber(today.overdueJobs || 0)} tone="red" />
            </div>
            <div className="mt-3 rounded-2xl border border-[#1f4b8f]/8 bg-white p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="font-semibold text-[#3f363a]">Today task progress</p>
                <p className="text-[#1f4b8f]">
                  {formatNumber(today.dueTodayReady || 0)} / {formatNumber(today.dueTodayTotal || 0)} ready
                </p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#e7eef8]">
                <div
                  className="h-full rounded-full bg-[#1f4b8f] transition-all"
                  style={{ width: `${taskProgressPercent}%` }}
                />
              </div>
              {today.dueTodayTotal > 0 && today.dueTodayRemaining === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[#1f4b8f]">
                  🎈💸 Well done, tasks completed.
                </p>
              ) : (
                <p className="mt-3 text-sm text-[#7b7276]">
                  {today.dueTodayTotal > 0
                    ? `${formatNumber(today.dueTodayRemaining || 0)} due-today task${
                        today.dueTodayRemaining === 1 ? "" : "s"
                      } still waiting.`
                    : "No 48-hour tasks are due today."}
                </p>
              )}
            </div>
            {prepItems.length > 0 ? (
              <div className="mt-3 space-y-2">
                {prepItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[#1f4b8f]/8 bg-white px-4 py-3 text-sm">
                    <p className="font-semibold text-[#3f363a]">{getPrepTaskName(item)}</p>
                    <p className="mt-1 text-[#5c5357]">{getPrepTaskDetail(item)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onMarkReady(item)}
                        disabled={actionState.loading}
                        className="rounded-full border border-[#1f4b8f]/12 bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#1f4b8f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark ready
                      </button>
                      {!item.thirdPartyPartner && buildWhatsAppHref(item.whatsAppNumber, item) && (
                        <a
                          href={buildWhatsAppHref(item.whatsAppNumber, item)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#1f4b8f]/12 bg-white px-3 py-1 text-xs font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                        >
                          WhatsApp customer
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#7b7276]">
                No prep items waiting.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#e1251b]">Third-party deliveries</p>
              <button
                type="button"
                onClick={() => downloadManagementExport("deliveries")}
                className="rounded-full border border-[#e1251b]/16 bg-white px-3 py-2 text-xs font-semibold text-[#e1251b] transition hover:bg-[#fff8f7]"
              >
                Delivery CSV
              </button>
            </div>
            {deliveryItems.length > 0 ? (
              <div className="mt-3 space-y-2">
                {deliveryItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[#e1251b]/16 bg-white px-4 py-3 text-sm">
                    <p className="font-semibold text-[#3f363a]">{item.thirdPartyPartner}</p>
                    <p className="mt-1 text-[#7c4642]">
                      {item.customerName} - {formatNumber(item.quantity)} {item.serviceName}
                    </p>
                    <button
                      type="button"
                      onClick={() => onMarkDelivered(item)}
                      disabled={actionState.loading}
                      className="mt-3 rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold text-[#e1251b] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Mark delivered
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-[#e1251b]/16 bg-white p-4 text-sm text-[#7c4642]">
                No deliveries waiting.
              </p>
            )}
          </div>
        </div>
        {actionState.error && (
          <div className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
            {actionState.error}
          </div>
        )}
        {actionState.success && (
          <div className="rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
            {actionState.success}
          </div>
        )}
      </div>

      <form
        onSubmit={onExpenseSubmit}
        className="hidden mt-5 rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4"
      >
        <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Track spending</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="expenseDescription">
              Description
            </label>
            <input
              id="expenseDescription"
              value={expenseForm.description}
              onChange={(event) => onExpenseChange("description", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              placeholder="e.g. shoe soap"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="expenseCategory">
              Category
            </label>
            <select
              id="expenseCategory"
              value={expenseForm.category}
              onChange={(event) => onExpenseChange("category", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            >
              <option value="supplies">Supplies</option>
              <option value="cleaning_products">Cleaning products</option>
              <option value="packaging">Packaging</option>
              <option value="transport">Transport</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="expenseAmount">
              Amount
            </label>
            <input
              id="expenseAmount"
              type="number"
              min="0"
              step="0.01"
              value={expenseForm.amount}
              onChange={(event) => onExpenseChange("amount", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="expenseDate">
              Date
            </label>
            <input
              id="expenseDate"
              type="date"
              value={expenseForm.expenseDate}
              onChange={(event) => onExpenseChange("expenseDate", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[0.35fr_1fr]">
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="expenseQuantity">
              Quantity
            </label>
            <input
              id="expenseQuantity"
              type="number"
              min="1"
              step="1"
              value={expenseForm.quantity}
              onChange={(event) => onExpenseChange("quantity", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="expenseNotes">
              Notes
            </label>
            <input
              id="expenseNotes"
              value={expenseForm.notes}
              onChange={(event) => onExpenseChange("notes", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              placeholder="Optional"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={expenseState.loading}
          className="mt-4 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
        >
          {expenseState.loading ? "Saving expense..." : "Record expense"}
        </button>
        {expenseState.error && (
          <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
            {expenseState.error}
          </div>
        )}
        {expenseState.success && (
          <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#1f4b8f]">
            {expenseState.success}
          </div>
        )}
        {actionState.error && (
          <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
            {actionState.error}
          </div>
        )}
        {actionState.success && (
          <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#1f4b8f]">
            {actionState.success}
          </div>
        )}
      </form>

      <form
        onSubmit={onPriceSubmit}
        className="hidden mt-5 rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4"
      >
        <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Service price settings</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_0.7fr_1fr]">
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="priceService">
              Service
            </label>
            <select
              id="priceService"
              value={priceForm.serviceId}
              onChange={(event) => onPriceChange("serviceId", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            >
              <option value="">Choose service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.category.name} - {service.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="priceAmount">
              Default price
            </label>
            <input
              id="priceAmount"
              type="number"
              min="0"
              step="0.01"
              value={priceForm.defaultUnitPrice}
              onChange={(event) => onPriceChange("defaultUnitPrice", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              placeholder="Leave empty if configurable"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-sm font-semibold text-[#3f363a]">
              <input
                type="checkbox"
                checked={priceForm.allowPriceOverride}
                onChange={(event) => onPriceChange("allowPriceOverride", event.target.checked)}
              />
              Override
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-sm font-semibold text-[#3f363a]">
              <input
                type="checkbox"
                checked={priceForm.loyaltyEligible}
                onChange={(event) => onPriceChange("loyaltyEligible", event.target.checked)}
              />
              Loyalty
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-sm font-semibold text-[#3f363a]">
              <input
                type="checkbox"
                checked={priceForm.active}
                onChange={(event) => onPriceChange("active", event.target.checked)}
              />
              Active
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={priceState.loading}
          className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:bg-[#f4f6fa] disabled:text-[#9aa2b4]"
        >
          {priceState.loading ? "Saving price..." : "Save service price"}
        </button>
        {priceState.error && (
          <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
            {priceState.error}
          </div>
        )}
        {priceState.success && (
          <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#1f4b8f]">
            {priceState.success}
          </div>
        )}
      </form>

      <div className="hidden mt-5 rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Top customers</p>
        {topCustomers.length > 0 ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {topCustomers.slice(0, 6).map((customer) => (
              <div key={customer.customerId} className="rounded-2xl border border-[#1f4b8f]/8 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#3f363a]">{customer.customerName}</p>
                    <p className="mt-1 text-sm text-[#7b7276]">{customer.whatsAppNumber}</p>
                    <p className="mt-1 text-xs text-[#7b7276]">
                      Visits: {customer.totalVisits} - Shoes: {formatNumber(customer.totalShoes)}
                    </p>
                  </div>
                  <p className="font-semibold text-[#1f4b8f]">{formatCurrency(customer.totalSpent)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#7b7276]">
            No customer spending recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ServiceVisitAdmin() {
  const [state, setState] = useState({
    loading: true,
    configured: false,
    schemaReady: false,
    message: "",
    categories: [],
    services: [],
    customers: [],
    recentVisits: [],
    dailySummary: [],
    ownerSummary: null,
    topCustomers: [],
    prepItems: [],
    deliveryItems: [],
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [visitForm, setVisitForm] = useState(emptyVisitForm);
  const [lineForm, setLineForm] = useState(emptyLineForm);
  const [visitItems, setVisitItems] = useState([]);
  const [saveState, setSaveState] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [expenseState, setExpenseState] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [actionState, setActionState] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [reportFilters, setReportFilters] = useState(defaultReportFilters);
  const [priceForm, setPriceForm] = useState(emptyPriceForm);
  const [priceState, setPriceState] = useState({
    loading: false,
    error: "",
    success: "",
  });

  const fetchManagementData = useCallback(async (filters = defaultReportFilters) => {
    const params = new URLSearchParams({
      preset: filters.preset,
      date: filters.date,
      month: filters.month,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    const response = await fetch(`/api/admin/management?${params.toString()}`, { cache: "no-store" });

    return response.json();
  }, []);

  function applyManagementData(data) {
    setState({
      loading: false,
      configured: data.configured,
      schemaReady: data.schemaReady,
      message: data.message || "",
      categories: data.categories || [],
      services: data.services || [],
      customers: data.customers || [],
      recentVisits: data.recentVisits || [],
      dailySummary: data.dailySummary || [],
      ownerSummary: data.ownerSummary || null,
      topCustomers: data.topCustomers || [],
      prepItems: data.prepItems || [],
      deliveryItems: data.deliveryItems || [],
    });
  }

  async function refreshManagementData() {
    setState((current) => ({
      ...current,
      loading: true,
    }));

    try {
      const data = await fetchManagementData();
      applyManagementData(data);
    } catch (error) {
      applyManagementData({
        configured: false,
        schemaReady: false,
        message: error.message || "Unable to load CleanStep service records.",
      });
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitialManagementData() {
      try {
        const data = await fetchManagementData();

        if (!mounted) {
          return;
        }

        applyManagementData(data);
      } catch (error) {
        if (!mounted) {
          return;
        }

        applyManagementData({
          configured: false,
          schemaReady: false,
          message: error.message || "Unable to load CleanStep service records.",
        });
      }
    }

    loadInitialManagementData();

    return () => {
      mounted = false;
    };
  }, [fetchManagementData]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    if (!query) {
      return state.customers.slice(0, 8);
    }

    return state.customers.filter(
      (customer) =>
        customer.customerName.toLowerCase().includes(query) ||
        customer.whatsAppNumber.toLowerCase().includes(query),
    );
  }, [customerSearch, state.customers]);

  const categoriesForServiceGroup = useMemo(
    () =>
      state.categories.filter(
        (category) => getServiceGroupForCategory(category) === lineForm.serviceGroup,
      ),
    [lineForm.serviceGroup, state.categories],
  );
  const servicesForCategory = useMemo(
    () =>
      state.services.filter(
        (service) => service.category.code === lineForm.categoryCode,
      ),
    [lineForm.categoryCode, state.services],
  );
  const selectedService = state.services.find((service) => service.id === lineForm.serviceId);
  const effectiveThirdPartyPartner =
    visitForm.recordType === "third_party" ? visitForm.thirdPartyPartner : lineForm.thirdPartyPartner;
  const visitTotal = visitItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const todaySummary = state.dailySummary.filter(
    (item) => item.visitDate === new Date().toISOString().slice(0, 10),
  );
  const todayTotal = todaySummary.reduce((sum, item) => sum + item.totalRevenue, 0);

  function updateVisitField(key, value) {
    setVisitForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "recordType" && value === "client" ? { thirdPartyPartner: "" } : {}),
    }));

    if (key === "thirdPartyPartner" || key === "recordType") {
      setLineForm((current) => {
        const thirdPartyPartner =
          key === "thirdPartyPartner"
            ? value
            : value === "client"
              ? ""
              : visitForm.thirdPartyPartner;
        const defaultUnitPrice = getServiceDefaultUnitPrice(selectedService, thirdPartyPartner);

        return {
          ...current,
          thirdPartyPartner,
          unitPrice: defaultUnitPrice === "" ? current.unitPrice : defaultUnitPrice,
        };
      });
      setVisitItems((current) =>
        current.map((item) => {
          const thirdPartyPartner =
            key === "thirdPartyPartner"
              ? value
              : value === "client"
                ? ""
                : visitForm.thirdPartyPartner;
          const service = state.services.find((serviceItem) => serviceItem.id === item.serviceId);
          const recalculatedUnitPrice = getServiceDefaultUnitPrice(service, thirdPartyPartner);
          const unitPrice =
            recalculatedUnitPrice === "" ? item.unitPrice : Number(recalculatedUnitPrice);

          return {
            ...item,
            thirdPartyPartner,
            unitPrice,
            lineTotal: item.quantity * unitPrice,
          };
        }),
      );
    }

    setSaveState({
      loading: false,
      error: "",
      success: "",
    });
  }

  function updateLineField(key, value) {
    if (key === "quantity") {
      setLineForm((current) => ({
        ...current,
        quantity: normalizeServiceQuantity(selectedService, value),
      }));
      setSaveState((current) => ({
        ...current,
        error: "",
      }));
      return;
    }

    setLineForm((current) => {
      const defaultUnitPrice =
        key === "thirdPartyPartner" ? getServiceDefaultUnitPrice(selectedService, value) : "";

      return {
        ...current,
        [key]: value,
        ...(defaultUnitPrice !== "" ? { unitPrice: defaultUnitPrice } : {}),
      };
    });
    setSaveState((current) => ({
      ...current,
      error: "",
    }));
  }

  function selectCustomer(customer) {
    setSelectedCustomerId(customer.customerId);
    setCustomerSearch(customer.customerName);
    setVisitForm((current) => ({
      ...current,
      customerName: customer.customerName,
      whatsAppNumber: customer.whatsAppNumber,
    }));
  }

  function selectServiceGroup(serviceGroup) {
    const matchingCategories = state.categories.filter(
      (category) => getServiceGroupForCategory(category) === serviceGroup,
    );

    setLineForm({
      ...emptyLineForm,
      serviceGroup,
      categoryCode: matchingCategories.length === 1 ? matchingCategories[0].code : "",
    });
  }

  function selectCategory(categoryCode) {
    setLineForm({
      ...emptyLineForm,
      serviceGroup: lineForm.serviceGroup,
      categoryCode,
    });
  }

  function selectService(serviceId) {
    const service = state.services.find((item) => item.id === serviceId);

    setLineForm((current) => ({
      ...current,
      serviceId,
      quantity: normalizeServiceQuantity(service, current.quantity) || 1,
      unitPrice: getServiceDefaultUnitPrice(service, effectiveThirdPartyPartner),
    }));
  }

  function addLineItem() {
    const lineItem = buildLineItem(selectedService, {
      ...lineForm,
      thirdPartyPartner:
        visitForm.recordType === "third_party" ? visitForm.thirdPartyPartner : lineForm.thirdPartyPartner,
    });

    if (!lineItem) {
      setSaveState({
        loading: false,
        error: "Choose a service and quantity before adding it to the visit.",
        success: "",
      });
      return;
    }

    if (visitForm.recordType === "third_party" && !visitForm.thirdPartyPartner) {
      setSaveState({
        loading: false,
        error: "Choose Eldoraigne, Kitwe, or Clubview before adding a third-party item.",
        success: "",
      });
      return;
    }

    setVisitItems((current) => [...current, lineItem]);
    setLineForm({
      ...emptyLineForm,
      serviceGroup: lineForm.serviceGroup,
      categoryCode: lineForm.categoryCode,
    });
  }

  function removeLineItem(localId) {
    setVisitItems((current) => current.filter((item) => item.localId !== localId));
  }

  function updateExpenseField(key, value) {
    setExpenseForm((current) => ({
      ...current,
      [key]: value,
    }));
    setExpenseState({
      loading: false,
      error: "",
      success: "",
    });
  }

  function updateReportFilter(key, value) {
    setReportFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function refreshReportWithFilters() {
    await refreshManagementData();
  }

  function updatePriceField(key, value) {
    const nextForm = {
      ...priceForm,
      [key]: value,
    };

    if (key === "serviceId") {
      const selected = state.services.find((service) => service.id === value);

      if (selected) {
        nextForm.defaultUnitPrice =
          selected.defaultUnitPrice === null ? "" : String(selected.defaultUnitPrice);
        nextForm.allowPriceOverride = selected.allowPriceOverride;
        nextForm.loyaltyEligible = selected.loyaltyEligible;
        nextForm.active = true;
      }
    }

    setPriceForm(nextForm);
    setPriceState({
      loading: false,
      error: "",
      success: "",
    });
  }

  async function handleSaveVisit(event) {
    event.preventDefault();

    setSaveState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch("/api/admin/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...visitForm,
          customerId: selectedCustomerId,
          recordType: visitForm.recordType,
          thirdPartyPartner: visitForm.recordType === "third_party" ? visitForm.thirdPartyPartner : "",
          items: visitItems.map((item) => ({
            serviceId: item.serviceId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            thirdPartyPartner: item.thirdPartyPartner,
            notes: item.notes,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.message || "Unable to save the CleanStep service visit.");
      }

      setSaveState({
        loading: false,
        error: "",
        success: data.loyaltyMirror
          ? `${data.message} Loyalty also received ${formatNumber(data.loyaltyMirror.points)} point${data.loyaltyMirror.points === 1 ? "" : "s"}.`
          : data.message,
      });
      setVisitItems([]);
      setLineForm(emptyLineForm);
      setVisitForm((current) => ({
        ...emptyVisitForm,
        customerName: visitForm.recordType === "client" ? current.customerName : "",
        whatsAppNumber: visitForm.recordType === "client" ? current.whatsAppNumber : "",
      }));
      await refreshManagementData();
    } catch (error) {
      setSaveState({
        loading: false,
        error: error.message || "Unable to save the CleanStep service visit.",
        success: "",
      });
    }
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    setExpenseState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch("/api/admin/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recordExpense",
          ...expenseForm,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.message || "Unable to record the expense.");
      }

      setExpenseState({
        loading: false,
        error: "",
        success: data.message,
      });
      setExpenseForm(emptyExpenseForm);
      await refreshManagementData();
    } catch (error) {
      setExpenseState({
        loading: false,
        error: error.message || "Unable to record the expense.",
        success: "",
      });
    }
  }

  async function handlePriceSubmit(event) {
    event.preventDefault();
    setPriceState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch("/api/admin/management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateServicePrice",
          ...priceForm,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.message || "Unable to update the service price.");
      }

      setPriceState({
        loading: false,
        error: "",
        success: data.message,
      });
      setPriceForm(emptyPriceForm);
      await refreshManagementData();
    } catch (error) {
      setPriceState({
        loading: false,
        error: error.message || "Unable to update the service price.",
        success: "",
      });
    }
  }

  async function updateVisitItemStatus(item, action) {
    if (!item?.id) {
      return;
    }

    setActionState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch("/api/admin/management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          itemId: item.id,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.message || "Unable to update that item.");
      }

      setActionState({
        loading: false,
        error: "",
        success: data.message,
      });
      await refreshManagementData();
    } catch (error) {
      setActionState({
        loading: false,
        error: error.message || "Unable to update that item.",
        success: "",
      });
    }
  }

  async function handleDeleteServiceVisit(visit) {
    if (!visit?.id) {
      return;
    }

    const confirmed = window.confirm(`Delete ${visit.customerName}'s service visit from ${visit.visitDate}?`);

    if (!confirmed) {
      return;
    }

    setActionState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const params = new URLSearchParams({ visitId: visit.id });
      const response = await fetch(`/api/admin/management?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.deleted) {
        throw new Error(data.message || "Unable to delete the service visit.");
      }

      setActionState({
        loading: false,
        error: "",
        success: data.message,
      });
      await refreshManagementData();
    } catch (error) {
      setActionState({
        loading: false,
        error: error.message || "Unable to delete the service visit.",
        success: "",
      });
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Client and loyalty records</p>
          <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">Record everything brought in</h2>
        </div>
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Today service total</p>
          <p className="mt-1 text-xl font-semibold text-[#1f4b8f]">{formatCurrency(todayTotal)}</p>
        </div>
      </div>

      {state.loading && (
        <div className="mt-6 rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-4 text-sm text-[#7b7276]">
          Loading service records...
        </div>
      )}

      {!state.loading && state.message && (
        <div
          className={classNames(
            "mt-6 rounded-2xl border p-4 text-sm",
            state.schemaReady
              ? "border-[#e1251b]/16 bg-[#fff3f2] text-[#7c4642]"
              : "border-[#1f4b8f]/12 bg-[#eef4ff] text-[#1f4b8f]",
          )}
        >
          {state.message}
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-4">
        <p className="text-sm font-semibold text-[#3f363a]">What are we recording?</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { value: "client", label: "Client / loyalty" },
            { value: "third_party", label: "Third party" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                updateVisitField("recordType", option.value);
                setLineForm(emptyLineForm);
                setVisitItems([]);
              }}
              className={classNames(
                "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                visitForm.recordType === option.value
                  ? "border-[#1f4b8f] bg-white text-[#1f4b8f]"
                  : "border-[#1f4b8f]/12 bg-white/70 text-[#3f363a] hover:bg-white",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {visitForm.recordType === "third_party" && (
          <div className="mt-4">
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="visitThirdPartyPartner">
              Third-party partner
            </label>
            <select
              id="visitThirdPartyPartner"
              value={visitForm.thirdPartyPartner}
              onChange={(event) => updateVisitField("thirdPartyPartner", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
            >
              <option value="">Choose partner</option>
              <option value="Eldoraigne">Eldoraigne</option>
              <option value="Kitwe">Kitwe</option>
              <option value="Clubview">Clubview</option>
            </select>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveVisit} className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {visitForm.recordType === "client" && (
            <>
              <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-4">
                <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceCustomerSearch">
                  Search customer
                </label>
                <input
                  id="serviceCustomerSearch"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  placeholder="Search by name or WhatsApp number"
                />
                {filteredCustomers.length > 0 && (
                  <div className="mt-3 grid gap-3">
                    {filteredCustomers.slice(0, 5).map((customer) => (
                      <button
                        key={customer.customerId}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-3 text-left transition hover:bg-[#eef4ff]"
                      >
                        <p className="font-semibold text-[#3f363a]">{customer.customerName}</p>
                        <p className="mt-1 text-sm text-[#5c5357]">{customer.whatsAppNumber}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceCustomerName">
                    Customer name
                  </label>
                  <input
                    id="serviceCustomerName"
                    value={visitForm.customerName}
                    onChange={(event) => updateVisitField("customerName", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                    placeholder="Customer full name"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceWhatsApp">
                    WhatsApp number
                  </label>
                  <input
                    id="serviceWhatsApp"
                    value={visitForm.whatsAppNumber}
                    onChange={(event) => updateVisitField("whatsAppNumber", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                    placeholder="e.g. 069 110 2046"
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceVisitDate">
                Date received
              </label>
              <input
                id="serviceVisitDate"
                type="date"
                value={visitForm.visitDate}
                onChange={(event) => updateVisitField("visitDate", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#3f363a]" htmlFor="servicePaymentMethod">
                Payment
              </label>
              <select
                id="servicePaymentMethod"
                value={visitForm.paymentMethod}
                onChange={(event) => updateVisitField("paymentMethod", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mixed">Mixed</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceVisitNotes">
              Notes
            </label>
            <textarea
              id="serviceVisitNotes"
              value={visitForm.notes}
              onChange={(event) => updateVisitField("notes", event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-4">
            <p className="text-sm font-semibold text-[#3f363a]">Add service item</p>
            <div className="mt-3 grid gap-3">
              {SERVICE_GROUPS.map((group) => (
                <button
                  key={group.value}
                  type="button"
                  onClick={() => selectServiceGroup(group.value)}
                  disabled={!state.schemaReady}
                  className={classNames(
                    "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                    lineForm.serviceGroup === group.value
                      ? "border-[#1f4b8f] bg-[#eef4ff] text-[#1f4b8f]"
                      : "border-[#1f4b8f]/12 bg-white text-[#3f363a] hover:bg-[#eef4ff]",
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceCategory">
                Category
              </label>
              <select
                id="serviceCategory"
                value={lineForm.categoryCode}
                onChange={(event) => selectCategory(event.target.value)}
                disabled={!lineForm.serviceGroup || !state.schemaReady}
                className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f] disabled:cursor-not-allowed disabled:bg-[#f4f6fa]"
              >
                <option value="">
                  {lineForm.serviceGroup ? "Choose category" : "Choose shoes, carpets, couches, bags, or mattress first"}
                </option>
                {categoriesForServiceGroup.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceItem">
                Option and price
              </label>
              <select
                id="serviceItem"
                value={lineForm.serviceId}
                onChange={(event) => selectService(event.target.value)}
                disabled={!lineForm.categoryCode || !state.schemaReady}
                className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f] disabled:cursor-not-allowed disabled:bg-[#f4f6fa]"
              >
                <option value="">
                  {lineForm.categoryCode ? "Choose option" : "Choose the category first"}
                </option>
                {servicesForCategory.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                    {service.defaultUnitPrice !== null
                      ? ` - ${formatCurrency(getServiceDefaultUnitPrice(service, effectiveThirdPartyPartner))}`
                      : " - configurable"}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceQuantity">
                  Quantity
                </label>
                <input
                  id="serviceQuantity"
                  type="number"
                  min={isWholeQuantityService(selectedService) ? "1" : "0.01"}
                  step={isWholeQuantityService(selectedService) ? "1" : "0.01"}
                  value={lineForm.quantity}
                  onChange={(event) => updateLineField("quantity", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceUnitPrice">
                  Unit price
                </label>
                <input
                  id="serviceUnitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={lineForm.unitPrice}
                  onChange={(event) => updateLineField("unitPrice", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visitForm.recordType === "client" ? (
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]" htmlFor="thirdPartyPartner">
                    Send to third-party
                  </label>
                  <select
                    id="thirdPartyPartner"
                    value={lineForm.thirdPartyPartner}
                    onChange={(event) => updateLineField("thirdPartyPartner", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  >
                    <option value="">No</option>
                    <option value="Eldoraigne">Eldoraigne</option>
                    <option value="Kitwe">Kitwe</option>
                    <option value="Clubview">Clubview</option>
                  </select>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#1f4b8f]/10 bg-white px-4 py-4 text-sm text-[#5c5357]">
                  <p className="font-semibold text-[#3f363a]">Third-party record</p>
                  <p className="mt-1">
                    Partner: {visitForm.thirdPartyPartner || "Choose partner first"}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-[#3f363a]" htmlFor="serviceLineNotes">
                  Item notes
                </label>
                <input
                  id="serviceLineNotes"
                  value={lineForm.notes}
                  onChange={(event) => updateLineField("notes", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  placeholder="Optional"
                />
              </div>
            </div>

            {selectedService && (
              <div className="mt-4 rounded-2xl border border-[#1f4b8f]/10 bg-white p-4 text-sm text-[#5c5357]">
                <p>
                  {getReportGroupLabel(selectedService.category.reportGroup)} -{" "}
                  {selectedService.loyaltyEligible ? "loyalty eligible" : "reporting only"}
                </p>
                <p className="mt-1">
                  Line total:{" "}
                  <span className="font-semibold text-[#1f4b8f]">
                    {formatCurrency((Number(lineForm.quantity) || 0) * (Number(lineForm.unitPrice) || 0))}
                  </span>
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={addLineItem}
              disabled={!state.schemaReady}
              className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:bg-[#f4f6fa] disabled:text-[#9aa2b4]"
            >
              Add item to visit
            </button>
          </div>

          <div className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#3f363a]">Visit items</p>
              <p className="text-lg font-semibold text-[#1f4b8f]">{formatCurrency(visitTotal)}</p>
            </div>
            {visitItems.length > 0 ? (
              <div className="mt-3 space-y-3">
                {visitItems.map((item) => (
                  <div
                    key={item.localId}
                    className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#3f363a]">
                          {item.serviceName} - {item.categoryName}
                        </p>
                        <p className="mt-1 text-sm text-[#5c5357]">
                          {formatNumber(item.quantity)} {item.unitLabel} x {formatCurrency(item.unitPrice)}
                        </p>
                        {item.thirdPartyPartner && (
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#e1251b]">
                            {item.thirdPartyPartner} {getThirdPartyTaskLabel(item.thirdPartyPartner)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#1f4b8f]">{formatCurrency(item.lineTotal)}</p>
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.localId)}
                          className="mt-2 rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold text-[#e1251b] hover:bg-[#ffe7e4]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-[#1f4b8f]/12 bg-[#f8fbff] p-4 text-sm text-[#7b7276]">
                No service items added yet.
              </p>
            )}

            <button
              type="submit"
              disabled={saveState.loading || !state.schemaReady || visitItems.length === 0}
              className="mt-4 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
            >
              {saveState.loading
                ? visitForm.recordType === "third_party"
                  ? "Saving third-party record..."
                  : "Saving client visit..."
                : visitForm.recordType === "third_party"
                  ? "Save third-party record"
                  : "Save client visit"}
            </button>

            {saveState.error && (
              <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                {saveState.error}
              </div>
            )}
            {saveState.success && (
              <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                {saveState.success}
              </div>
            )}
          </div>
        </div>
      </form>

      {state.recentVisits.length > 0 && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Recent service visits</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {state.recentVisits.map((visit) => (
              <RecentServiceVisitCard
                key={visit.id}
                visit={visit}
                onDeleteVisit={handleDeleteServiceVisit}
                loadingAction={actionState.loading}
              />
            ))}
          </div>
        </div>
      )}
      </section>

      <div className="mt-10">
        <OwnerDashboardPanel
          ownerSummary={state.ownerSummary}
          services={state.services}
          topCustomers={state.topCustomers}
          prepItems={state.prepItems}
          deliveryItems={state.deliveryItems}
          reportFilters={reportFilters}
          priceForm={priceForm}
          priceState={priceState}
          expenseForm={expenseForm}
          expenseState={expenseState}
          actionState={actionState}
          onReportFilterChange={updateReportFilter}
          onReportRefresh={refreshReportWithFilters}
          onPriceChange={updatePriceField}
          onPriceSubmit={handlePriceSubmit}
          onExpenseChange={updateExpenseField}
          onExpenseSubmit={handleExpenseSubmit}
          onMarkReady={(item) => updateVisitItemStatus(item, "markReady")}
          onMarkDelivered={(item) => updateVisitItemStatus(item, "markDelivered")}
        />
      </div>
    </>
  );
}
