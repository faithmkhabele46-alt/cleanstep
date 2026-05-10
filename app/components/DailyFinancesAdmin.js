"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/booking";
import { addDaysToDateString } from "../lib/daily-finances";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
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
  });
  const [editingSaleId, setEditingSaleId] = useState("");
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

  const livePricing = useMemo(() => {
    if (!selectedProduct) {
      return {
        unitPrice: 0,
        total: 0,
        isBulkPrice: false,
      };
    }

    const quantity = Math.max(1, Number(saleForm.quantity) || 1);
    const isBulkPrice =
      Number.isFinite(selectedProduct.bulkThreshold) &&
      quantity > selectedProduct.bulkThreshold &&
      Number.isFinite(selectedProduct.bulkPrice);
    const unitPrice = isBulkPrice ? selectedProduct.bulkPrice : selectedProduct.basePrice;

    return {
      unitPrice,
      total: quantity * unitPrice,
      isBulkPrice,
    };
  }, [selectedProduct, saleForm.quantity]);

  function chooseProduct(productCode) {
    setSaleForm((current) => ({
      ...current,
      productCode,
    }));
    setSubmitState((current) => ({
      ...current,
      error: "",
      success: "",
    }));
  }

  function loadSaleIntoEditor(item) {
    setEditingSaleId(item.id);
    setSaleForm({
      productCode: item.productCode,
      quantity: item.quantity,
      paymentMethod: item.paymentMethod,
    });
    if (item.saleDate && item.saleDate !== financeState.saleDate) {
      handleSaleDateChange(item.saleDate);
    }
    setSubmitState({
      loading: false,
      error: "",
      success: `Editing ${item.productName}. Save to update it.`,
    });
  }

  function resetEditor() {
    setEditingSaleId("");
    setSaleForm((current) => ({
      ...current,
      quantity: 1,
    }));
    setSubmitState({
      loading: false,
      error: "",
      success: "",
    });
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

  async function handleSaveSale() {
    if (!saleForm.productCode) {
      setSubmitState({
        loading: false,
        error: "Choose the item you sold first.",
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
        method: editingSaleId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saleId: editingSaleId,
          productCode: saleForm.productCode,
          quantity: saleForm.quantity,
          paymentMethod: saleForm.paymentMethod,
          saleDate: financeState.saleDate,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save the sale.");
      }

      setFinanceState((current) => ({
        ...current,
        items: data.items || [],
        summary: data.summary || current.summary,
        history: data.history || current.history,
      }));
      setSaleForm((current) => ({
        ...current,
        quantity: 1,
      }));
      setEditingSaleId("");
      setSubmitState({
        loading: false,
        error: "",
        success: data.message || (editingSaleId ? "Sale updated successfully." : "Sale saved successfully."),
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error: error.message || "Unable to save the sale.",
        success: "",
      });
    }
  }

  async function handleDeleteSale(item) {
    const confirmed = window.confirm(`Delete ${item.productName} from ${item.saleDate}?`);

    if (!confirmed) {
      return;
    }

    setSubmitState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch(
        `/api/admin/daily-finances?saleId=${encodeURIComponent(item.id)}&saleDate=${encodeURIComponent(financeState.saleDate)}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete the sale.");
      }

      setFinanceState((current) => ({
        ...current,
        items: data.items || [],
        summary: data.summary || current.summary,
        history: data.history || current.history,
      }));
      if (editingSaleId === item.id) {
        setEditingSaleId("");
      }
      setSubmitState({
        loading: false,
        error: "",
        success: data.message || "Sale deleted successfully.",
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error: error.message || "Unable to delete the sale.",
        success: "",
      });
    }
  }

  return (
    <section className="mt-10 rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
      <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Daily finances</p>
      <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">See what sold today</h2>
      <p className="mt-2 text-sm text-[#5c5357]">
        Tap the item, choose cash or card, and save the sale. Cleanstep updates the daily totals automatically.
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

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Record new sale</p>
                  <p className="mt-2 text-lg font-semibold text-[#3f363a]">
                    Trading date: {financeState.saleDate || "Today"}
                  </p>
                  {editingSaleId && (
                    <p className="mt-2 text-sm font-semibold text-[#e1251b]">
                      You are editing an existing sale.
                    </p>
                  )}
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
                      {formatCurrency(product.basePrice)} each
                      {product.bulkPrice
                        ? ` - Over ${product.bulkThreshold} = ${formatCurrency(product.bulkPrice)} each`
                        : ""}
                    </p>
                  </button>
                ))}
              </div>

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
                <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Sale preview</p>
                <p className="mt-3 text-lg font-semibold text-[#3f363a]">
                  {selectedProduct ? selectedProduct.name : "Choose an item"}
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
                onClick={handleSaveSale}
                className="mt-5 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
              >
                {submitState.loading ? "Saving sale..." : editingSaleId ? "Update sale" : "Save sale"}
              </button>
              {editingSaleId && (
                <button
                  type="button"
                  onClick={resetEditor}
                  className="mt-3 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                >
                  Cancel editing
                </button>
              )}

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
                            {entry.totalTransactions} sale{entry.totalTransactions === 1 ? "" : "s"} - {entry.totalUnits} unit{entry.totalUnits === 1 ? "" : "s"}
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
                        key={item.productCode}
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
                <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Recent sales</p>
                {financeState.items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {financeState.items.slice(0, 12).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#1f4b8f]/10 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#3f363a]">{item.productName}</p>
                            <p className="mt-1 text-sm text-[#7b7276]">
                              {item.quantity} x {formatCurrency(item.unitPrice)}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#9aa2b4]">
                              {item.saleDate}
                            </p>
                          </div>
                        <div className="text-right">
                          <p className="font-semibold text-[#1f4b8f]">{formatCurrency(item.total)}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b7276]">
                            {item.paymentMethod}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => loadSaleIntoEditor(item)}
                          className="rounded-full border border-[#1f4b8f]/12 bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#1f4b8f] hover:bg-[#ddeaff]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(item)}
                          className="rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold text-[#e1251b] hover:bg-[#ffe7e4]"
                        >
                          Delete
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
