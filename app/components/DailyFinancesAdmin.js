"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/booking";
import {
  addDaysToDateString,
  calculateDailyFinancePricing,
} from "../lib/daily-finances";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function formatTransactionTimestamp(createdAt = "", saleDate = "") {
  if (!createdAt) {
    return saleDate || "";
  }

  const parsed = new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return saleDate || "";
  }

  const timeLabel = parsed.toLocaleTimeString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return saleDate ? `${saleDate} at ${timeLabel}` : timeLabel;
}

function buildTransactions(items = []) {
  const grouped = new Map();

  items.forEach((item) => {
    const key = item.createdAt || item.transactionGroupId || item.id;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        saleDate: item.saleDate,
        createdAt: item.createdAt,
        paymentMethod: item.paymentMethod,
        total: 0,
        lines: [],
        fallbackSaleId: item.id,
      });
    }

    const current = grouped.get(key);
    current.total += Number(item.total || 0);
    current.lines.push(item);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function SummaryStat({ label, value, accent = "blue" }) {
  const accentClass =
    accent === "red"
      ? "text-[#e1251b]"
      : accent === "green"
        ? "text-[#177245]"
        : "text-[#1f4b8f]";

  return (
    <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">{label}</p>
      <p className={classNames("mt-3 text-3xl font-semibold", accentClass)}>{value}</p>
    </div>
  );
}

export default function DailyFinancesAdmin() {
  const [financeState, setFinanceState] = useState({
    loading: true,
    configured: false,
    message: "",
    saleDate: "",
    products: [],
    items: [],
    summary: {
      totalSales: 0,
      cashTotal: 0,
      cardTotal: 0,
      totalUnits: 0,
      productTotals: [],
    },
    history: [],
  });
  const [saleForm, setSaleForm] = useState({
    productCode: "",
    quantity: 1,
    paymentMethod: "cash",
    customAmount: "",
    customLabel: "",
  });
  const [transactionLines, setTransactionLines] = useState([]);
  const [submitState, setSubmitState] = useState({
    loading: false,
    error: "",
    success: "",
  });

  useEffect(() => {
    let mounted = true;

    async function loadDailyFinances(selectedDate = "") {
      try {
        const query = selectedDate ? `?saleDate=${encodeURIComponent(selectedDate)}` : "";
        const response = await fetch(`/api/admin/daily-finances${query}`, { cache: "no-store" });
        const data = await response.json();

        if (!mounted) {
          return;
        }

        setFinanceState({
          loading: false,
          configured: data.configured,
          message: data.message || "",
          saleDate: data.saleDate || "",
          products: data.products || [],
          items: data.items || [],
          summary: data.summary || {
            totalSales: 0,
            cashTotal: 0,
            cardTotal: 0,
            totalUnits: 0,
            productTotals: [],
          },
          history: data.history || [],
        });

        setSaleForm((current) => ({
          ...current,
          productCode: current.productCode || data.products?.[0]?.code || "",
        }));
      } catch (error) {
        if (!mounted) {
          return;
        }

        setFinanceState({
          loading: false,
          configured: false,
          message: error.message || "Unable to load daily finances.",
          saleDate: "",
          products: [],
          items: [],
          summary: {
            totalSales: 0,
            cashTotal: 0,
            cardTotal: 0,
            totalUnits: 0,
            productTotals: [],
          },
          history: [],
        });
      }
    }

    loadDailyFinances();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSaleDateChange(nextDate) {
    setFinanceState((current) => ({
      ...current,
      loading: true,
      saleDate: nextDate,
    }));
    setSubmitState({
      loading: false,
      error: "",
      success: "",
    });

    try {
      const response = await fetch(
        `/api/admin/daily-finances?saleDate=${encodeURIComponent(nextDate)}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      setFinanceState({
        loading: false,
        configured: data.configured,
        message: data.message || "",
        saleDate: data.saleDate || nextDate,
        products: data.products || [],
        items: data.items || [],
        summary: data.summary || {
          totalSales: 0,
          cashTotal: 0,
          cardTotal: 0,
          totalUnits: 0,
          productTotals: [],
        },
        history: data.history || [],
      });
    } catch (error) {
      setFinanceState((current) => ({
        ...current,
        loading: false,
        message: error.message || "Unable to load that date.",
        items: [],
        summary: {
          totalSales: 0,
          cashTotal: 0,
          cardTotal: 0,
          totalUnits: 0,
          productTotals: [],
        },
        history: [],
      }));
    }
  }

  const selectedProduct = useMemo(
    () => financeState.products.find((item) => item.code === saleForm.productCode) || null,
    [financeState.products, saleForm.productCode],
  );

  const livePricing = useMemo(
    () =>
      calculateDailyFinancePricing(
        saleForm.productCode,
        saleForm.quantity,
        saleForm.customAmount,
      ),
    [saleForm.customAmount, saleForm.productCode, saleForm.quantity],
  );

  const transactionTotals = useMemo(() => {
    const total = transactionLines.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalUnits = transactionLines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return {
      total,
      totalUnits,
    };
  }, [transactionLines]);

  const groupedTransactions = useMemo(() => buildTransactions(financeState.items), [financeState.items]);

  function chooseProduct(productCode) {
    setSaleForm((current) => ({
      ...current,
      productCode,
      quantity: 1,
      customAmount: "",
      customLabel: "",
    }));
    setSubmitState((current) => ({
      ...current,
      error: "",
      success: "",
    }));
  }

  function changeQuantity(nextValue) {
    setSaleForm((current) => ({
      ...current,
      quantity: Math.min(500, Math.max(1, nextValue)),
    }));
    setSubmitState((current) => ({
      ...current,
      error: "",
      success: "",
    }));
  }

  function addLineToTransaction() {
    if (!selectedProduct || !livePricing.product) {
      setSubmitState({
        loading: false,
        error: "Choose the item you want to add first.",
        success: "",
      });
      return;
    }

    if (selectedProduct.allowsCustomAmount && livePricing.unitPrice <= 0) {
      setSubmitState({
        loading: false,
        error: "Enter the amount for Others before adding it.",
        success: "",
      });
      return;
    }

    const lineProductName = saleForm.customLabel?.trim() || selectedProduct.name;

    setTransactionLines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productCode: selectedProduct.code,
        productName: lineProductName,
        quantity: livePricing.quantity,
        unitPrice: livePricing.unitPrice,
        total: livePricing.total,
        customAmount: saleForm.customAmount,
        customLabel: saleForm.customLabel,
      },
    ]);
    setSaleForm((current) => ({
      ...current,
      quantity: 1,
      customAmount: "",
      customLabel: "",
    }));
    setSubmitState({
      loading: false,
      error: "",
      success: `${lineProductName} added to this transaction.`,
    });
  }

  function removeLineFromTransaction(lineId) {
    setTransactionLines((current) => current.filter((line) => line.id !== lineId));
    setSubmitState((current) => ({
      ...current,
      error: "",
    }));
  }

  async function handleSaveTransaction() {
    if (transactionLines.length === 0) {
      setSubmitState({
        loading: false,
        error: "Add at least one item to this transaction first.",
        success: "",
      });
      return;
    }

    setSubmitState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch("/api/admin/daily-finances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lines: transactionLines,
          paymentMethod: saleForm.paymentMethod,
          saleDate: financeState.saleDate,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save the transaction.");
      }

      setFinanceState((current) => ({
        ...current,
        items: data.items || [],
        summary: data.summary || current.summary,
        history: data.history || current.history,
      }));
      setTransactionLines([]);
      setSaleForm((current) => ({
        ...current,
        quantity: 1,
        customAmount: "",
        customLabel: "",
      }));
      setSubmitState({
        loading: false,
        error: "",
        success: data.message || "Transaction saved successfully.",
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error: error.message || "Unable to save the transaction.",
        success: "",
      });
    }
  }

  async function handleDeleteTransaction(transaction) {
    const confirmed = window.confirm(
      `Delete this transaction from ${formatTransactionTimestamp(
        transaction.createdAt,
        transaction.saleDate,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    setSubmitState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const params = new URLSearchParams({
        saleDate: financeState.saleDate,
      });

      if (transaction.id) {
        params.set("createdAt", transaction.id);
      } else if (transaction.fallbackSaleId) {
        params.set("saleId", transaction.fallbackSaleId);
      }

      const response = await fetch(`/api/admin/daily-finances?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete the transaction.");
      }

      setFinanceState((current) => ({
        ...current,
        items: data.items || [],
        summary: data.summary || current.summary,
        history: data.history || current.history,
      }));
      setSubmitState({
        loading: false,
        error: "",
        success: data.message || "Transaction deleted successfully.",
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error: error.message || "Unable to delete the transaction.",
        success: "",
      });
    }
  }

  function downloadTransactionsCsv() {
    if (groupedTransactions.length === 0) {
      setSubmitState({
        loading: false,
        error: "There are no transactions to download for this date.",
        success: "",
      });
      return;
    }

    const rows = [
      [
        "Sale Date",
        "Time",
        "Payment Method",
        "Item",
        "Quantity",
        "Unit Price",
        "Line Total",
        "Transaction Total",
      ],
    ];

    groupedTransactions.forEach((transaction) => {
      const timeOnly = formatTransactionTimestamp(transaction.createdAt, "")
        .replace(/^.*at /, "")
        .trim();

      transaction.lines.forEach((line, index) => {
        rows.push([
          transaction.saleDate,
          timeOnly,
          transaction.paymentMethod,
          line.productName,
          String(line.quantity),
          String(line.unitPrice),
          String(line.total),
          index === 0 ? String(transaction.total) : "",
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cleanstep-daily-finances-${financeState.saleDate || "today"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printDayReport() {
    if (groupedTransactions.length === 0) {
      setSubmitState({
        loading: false,
        error: "There are no transactions to print for this date.",
        success: "",
      });
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1100");

    if (!printWindow) {
      setSubmitState({
        loading: false,
        error: "Your browser blocked the print window. Please allow pop-ups and try again.",
        success: "",
      });
      return;
    }

    const transactionMarkup = groupedTransactions
      .map(
        (transaction) => `
          <div style="border:1px solid #dbe4f2;border-radius:16px;padding:16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;gap:16px;">
              <div>
                <div style="font-weight:700;color:#3f363a;">${formatTransactionTimestamp(
                  transaction.createdAt,
                  transaction.saleDate,
                )}</div>
                <div style="margin-top:6px;color:#5c5357;text-transform:capitalize;">${transaction.paymentMethod}</div>
              </div>
              <div style="font-weight:700;color:#1f4b8f;">${formatCurrency(transaction.total)}</div>
            </div>
            <div style="margin-top:12px;">
              ${transaction.lines
                .map(
                  (line) => `
                    <div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid #eef3fb;">
                      <div>${line.productName} (${line.quantity} x ${formatCurrency(line.unitPrice)})</div>
                      <div>${formatCurrency(line.total)}</div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
        `,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Cleanstep Daily Finances ${financeState.saleDate}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #3f363a; }
            h1 { color: #1f4b8f; margin-bottom: 8px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
            .card { border: 1px solid #dbe4f2; border-radius: 16px; padding: 16px; background: #f8fbff; }
            .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.16em; color: #7b7276; }
            .value { margin-top: 8px; font-size: 24px; font-weight: 700; color: #1f4b8f; }
          </style>
        </head>
        <body>
          <h1>Cleanstep Daily Finances</h1>
          <p>Trading date: ${financeState.saleDate}</p>
          <div class="summary">
            <div class="card"><div class="label">Total</div><div class="value">${formatCurrency(financeState.summary.totalSales)}</div></div>
            <div class="card"><div class="label">Cash</div><div class="value">${formatCurrency(financeState.summary.cashTotal)}</div></div>
            <div class="card"><div class="label">Card</div><div class="value">${formatCurrency(financeState.summary.cardTotal)}</div></div>
            <div class="card"><div class="label">Units sold</div><div class="value">${financeState.summary.totalUnits}</div></div>
          </div>
          <h2>Transactions</h2>
          ${transactionMarkup}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <section className="mt-10 rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
      <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Daily finances</p>
      <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">See what sold today</h2>
      <p className="mt-2 text-sm text-[#5c5357]">
        Build one customer transaction with several items, then save it once as cash or card.
      </p>

      {financeState.loading ? (
        <div className="mt-6 rounded-3xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-6 text-[#7b7276]">
          Loading daily finances...
        </div>
      ) : (
        <>
          {!financeState.configured && financeState.message && (
            <div className="mt-6 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
              {financeState.message}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStat label="Today total" value={formatCurrency(financeState.summary.totalSales)} />
            <SummaryStat label="Cash" value={formatCurrency(financeState.summary.cashTotal)} accent="green" />
            <SummaryStat label="Card" value={formatCurrency(financeState.summary.cardTotal)} accent="red" />
            <SummaryStat label="Units sold" value={String(financeState.summary.totalUnits || 0)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={printDayReport}
              className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-3 text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
            >
              Print daily report
            </button>
            <button
              type="button"
              onClick={downloadTransactionsCsv}
              className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-3 text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
            >
              Download CSV
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Record transaction</p>
                  <p className="mt-2 text-lg font-semibold text-[#3f363a]">
                    Trading date: {financeState.saleDate || "Today"}
                  </p>
                </div>
                <div className="rounded-full border border-[#1f4b8f]/12 bg-white px-4 py-2 text-sm font-semibold text-[#1f4b8f]">
                  {selectedProduct ? selectedProduct.category : "Choose item"}
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-semibold text-[#3f363a]" htmlFor="dailySaleDate">
                  Show finances for date
                </label>
                <input
                  id="dailySaleDate"
                  type="date"
                  value={financeState.saleDate}
                  onChange={(event) => handleSaleDateChange(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                />
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaleDateChange(addDaysToDateString(financeState.saleDate, -1))}
                    className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-3 text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                  >
                    Previous day
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaleDateChange(addDaysToDateString(financeState.saleDate, 1))}
                    className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-3 text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                  >
                    Next day
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {financeState.products.map((product) => (
                  <button
                    key={product.code}
                    type="button"
                    onClick={() => chooseProduct(product.code)}
                    className={classNames(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      saleForm.productCode === product.code
                        ? "border-[#1f4b8f] bg-[#eef4ff]"
                        : "border-[#1f4b8f]/12 bg-white hover:bg-[#fdfefe]",
                    )}
                  >
                    <p className="text-sm font-semibold text-[#3f363a]">{product.name}</p>
                    <p className="mt-1 text-sm text-[#5c5357]">
                      {product.allowsCustomAmount
                        ? "Enter any amount you charged for this item."
                        : `${formatCurrency(product.basePrice)} each${
                            product.bulkPrice
                              ? ` - From ${product.bulkThreshold} = ${formatCurrency(product.bulkPrice)} each`
                              : ""
                          }`}
                    </p>
                  </button>
                ))}
              </div>

              {selectedProduct?.allowsCustomAmount && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#3f363a]" htmlFor="customAmount">
                      Amount charged
                    </label>
                    <input
                      id="customAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleForm.customAmount}
                      onChange={(event) =>
                        setSaleForm((current) => ({
                          ...current,
                          customAmount: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                      placeholder="e.g. 25"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#3f363a]" htmlFor="customLabel">
                      What was sold? (optional)
                    </label>
                    <input
                      id="customLabel"
                      type="text"
                      value={saleForm.customLabel}
                      onChange={(event) =>
                        setSaleForm((current) => ({
                          ...current,
                          customLabel: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                      placeholder="e.g. Lamination"
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]">Quantity</label>
                  <div className="mt-2 rounded-[28px] border border-[#1f4b8f]/12 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => changeQuantity((Number(saleForm.quantity) || 1) - 1)}
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1f4b8f]/12 text-3xl font-light text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                      >
                        -
                      </button>
                      <div className="flex-1 text-center">
                        <p className="text-4xl font-semibold text-[#3f363a]">{saleForm.quantity}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#7b7276]">
                          unit{Number(saleForm.quantity) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => changeQuantity((Number(saleForm.quantity) || 1) + 1)}
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1f4b8f]/12 text-3xl font-light text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-[#3f363a]">Payment method</label>
                  <div className="mt-2 grid gap-3">
                    {PAYMENT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setSaleForm((current) => ({
                            ...current,
                            paymentMethod: option.value,
                          }))
                        }
                        className={classNames(
                          "rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition",
                          saleForm.paymentMethod === option.value
                            ? "border-[#1f4b8f] bg-[#eef4ff] text-[#1f4b8f]"
                            : "border-[#1f4b8f]/12 bg-white text-[#3f363a] hover:bg-[#f8fbff]",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-[#1f4b8f]/12 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Current item preview</p>
                <p className="mt-3 text-lg font-semibold text-[#3f363a]">
                  {saleForm.customLabel?.trim() || selectedProduct?.name || "Choose an item"}
                </p>
                <p className="mt-2 text-sm text-[#5c5357]">
                  Unit price: {formatCurrency(livePricing.unitPrice)}
                  {livePricing.isBulkPrice ? " - Bulk price applied" : ""}
                </p>
                <p className="mt-2 text-sm text-[#5c5357]">Payment: {saleForm.paymentMethod}</p>
                <p className="mt-4 text-3xl font-semibold text-[#1f4b8f]">
                  {formatCurrency(livePricing.total)}
                </p>
              </div>

              <button
                type="button"
                disabled={submitState.loading || !financeState.configured}
                onClick={addLineToTransaction}
                className="mt-5 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:bg-[#f2f4f8] disabled:text-[#8c8488]"
              >
                Add item to this transaction
              </button>

              <div className="mt-5 rounded-3xl border border-[#1f4b8f]/12 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Current transaction</p>
                    <p className="mt-2 text-lg font-semibold text-[#3f363a]">
                      {transactionLines.length} item{transactionLines.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Transaction total</p>
                    <p className="mt-2 text-2xl font-semibold text-[#1f4b8f]">
                      {formatCurrency(transactionTotals.total)}
                    </p>
                  </div>
                </div>

                {transactionLines.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {transactionLines.map((line) => (
                      <div
                        key={line.id}
                        className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#3f363a]">{line.productName}</p>
                            <p className="mt-1 text-sm text-[#5c5357]">
                              {line.quantity} x {formatCurrency(line.unitPrice)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[#1f4b8f]">{formatCurrency(line.total)}</p>
                            <button
                              type="button"
                              onClick={() => removeLineFromTransaction(line.id)}
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
                  <p className="mt-4 text-sm text-[#7b7276]">
                    Add copies, water, pens, Others, or anything else before saving the whole transaction.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={submitState.loading || !financeState.configured}
                onClick={handleSaveTransaction}
                className="mt-5 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
              >
                {submitState.loading ? "Saving transaction..." : "Save transaction"}
              </button>

              {submitState.error && (
                <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                  {submitState.error}
                </div>
              )}
              {submitState.success && (
                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                  {submitState.success}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Recent day totals</p>
                {financeState.history?.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {financeState.history.slice(0, 7).map((entry) => (
                      <button
                        key={entry.saleDate}
                        type="button"
                        onClick={() => handleSaleDateChange(entry.saleDate)}
                        className={classNames(
                          "flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition",
                          financeState.saleDate === entry.saleDate
                            ? "border-[#1f4b8f] bg-[#eef4ff]"
                            : "border-[#1f4b8f]/10 bg-white hover:bg-[#fdfefe]",
                        )}
                      >
                        <div>
                          <p className="font-semibold text-[#3f363a]">{entry.saleDate}</p>
                          <p className="mt-1 text-sm text-[#7b7276]">
                            {entry.totalTransactions} transaction{entry.totalTransactions === 1 ? "" : "s"} - {entry.totalUnits} unit{entry.totalUnits === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="font-semibold text-[#1f4b8f]">{formatCurrency(entry.totalSales)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#7b7276]">No finance history recorded yet.</p>
                )}
              </div>

              <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Today by item</p>
                {financeState.summary.productTotals?.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {financeState.summary.productTotals.map((item) => (
                      <div
                        key={`${item.productCode}:${item.productName}`}
                        className="flex items-center justify-between rounded-2xl border border-[#1f4b8f]/10 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-[#3f363a]">{item.productName}</p>
                          <p className="mt-1 text-sm text-[#7b7276]">{item.quantity} sold</p>
                        </div>
                        <p className="font-semibold text-[#1f4b8f]">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#7b7276]">No sales recorded yet for today.</p>
                )}
              </div>

              <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Recent transactions</p>
                {groupedTransactions.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {groupedTransactions.slice(0, 12).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-[#1f4b8f]/10 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#3f363a]">
                              {formatTransactionTimestamp(transaction.createdAt, transaction.saleDate)}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b7276]">
                              {transaction.paymentMethod}
                            </p>
                          </div>
                          <p className="font-semibold text-[#1f4b8f]">{formatCurrency(transaction.total)}</p>
                        </div>

                        <div className="mt-3 space-y-2">
                          {transaction.lines.map((line) => (
                            <div
                              key={line.id}
                              className="flex items-center justify-between rounded-2xl border border-[#1f4b8f]/8 bg-[#f8fbff] px-3 py-3"
                            >
                              <div>
                                <p className="font-medium text-[#3f363a]">{line.productName}</p>
                                <p className="mt-1 text-sm text-[#7b7276]">
                                  {line.quantity} x {formatCurrency(line.unitPrice)}
                                </p>
                              </div>
                              <p className="font-semibold text-[#1f4b8f]">{formatCurrency(line.total)}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(transaction)}
                            className="rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold text-[#e1251b] hover:bg-[#ffe7e4]"
                          >
                            Delete transaction
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#7b7276]">Nothing has been sold yet today.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
