"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/booking";

const loyaltyCategoryOptions = [
  { name: "Standard Sneakers & Shoes", value: "ordinary" },
  { name: "Suede, Nubuck & Leather", value: "suede" },
  { name: "Refurbish / Express", value: "refurbish" },
];

const loyaltyVariantOptions = [
  { name: "Other colours", value: "ordinary-other", category: "ordinary" },
  { name: "White", value: "ordinary-white", category: "ordinary" },
  { name: "Boots", value: "ordinary-boots", category: "ordinary" },
  { name: "Other colours", value: "suede-other", category: "suede" },
  { name: "White / Cream", value: "suede-white", category: "suede" },
  { name: "Boots", value: "suede-boots", category: "suede" },
  { name: "Same day", value: "refurbish-sameday", category: "refurbish" },
  { name: "Next day", value: "refurbish-nextday", category: "refurbish" },
  { name: "Deep Cleaning", value: "refurbish-deep", category: "refurbish" },
  { name: "Restore Colour", value: "refurbish-restore", category: "refurbish" },
];

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function getLoyaltyVisitLabel(form) {
  const category = loyaltyCategoryOptions.find((item) => item.value === form.visitCategory);
  const variant = loyaltyVariantOptions.find((item) => item.value === form.visitVariant);
  const quantity = Number(form.quantity) || 1;

  if (!category || !variant) {
    return "";
  }

  return `${variant.name} - ${category.name} (${quantity} item${quantity === 1 ? "" : "s"})`;
}

function LoyaltyVisitCard({ visit }) {
  return (
    <div className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-5 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">
            {visit.visitDate}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#3f363a]">{visit.customerName}</h2>
          <p className="mt-1 text-sm text-[#5c5357]">{visit.shoeType}</p>
        </div>
        {visit.receiptNumber && (
          <span className="rounded-full border border-[#1f4b8f]/14 bg-[#eef4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f4b8f]">
            {visit.receiptNumber}
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-3 text-sm text-[#5c5357] sm:grid-cols-3">
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">WhatsApp</p>
          <p className="mt-2">{visit.whatsAppNumber}</p>
        </div>
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Quantity</p>
          <p className="mt-2">{visit.quantity} item{visit.quantity === 1 ? "" : "s"}</p>
          <p className={classNames("mt-1 text-xs font-semibold", visit.qualifies ? "text-[#1f4b8f]" : "text-[#e1251b]")}>
            {visit.qualifies ? "Qualifies for reward" : "Does not count toward reward"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Notes</p>
          <p className="mt-2">{visit.notes || "No extra notes"}</p>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ booking }) {
  return (
    <div className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-5 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">
            {booking.booking_code || "Pending code"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#3f363a]">
            {booking.primary_item || booking.service_title}
          </h2>
          <p className="mt-1 text-sm text-[#5c5357]">{booking.service_title}</p>
        </div>
        <span className="rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#e1251b]">
          {booking.status || "pending"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-[#5c5357] sm:grid-cols-2">
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Address</p>
          <p className="mt-2">{booking.location || "Not set"}</p>
        </div>
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Date & Time</p>
          <p className="mt-2">
            {booking.booking_date || "Not set"}
            {booking.booking_time ? ` at ${booking.booking_time}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Customer</p>
          <p className="mt-2">{booking.customer_name || "Unknown customer"}</p>
          {booking.customer_email && <p className="mt-1 text-[#7b7276]">{booking.customer_email}</p>}
        </div>
        <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">Pricing</p>
          <p className="mt-2">Total: {formatCurrency(booking.total)}</p>
          <p className="mt-1 text-[#7b7276]">Deposit: {formatCurrency(booking.deposit)}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [bookingState, setBookingState] = useState({
    loading: true,
    configured: false,
    message: "",
    items: [],
  });
  const [loyaltyState, setLoyaltyState] = useState({
    loading: true,
    configured: false,
    message: "",
    items: [],
  });
  const [loyaltyForm, setLoyaltyForm] = useState({
    customerName: "",
    whatsAppNumber: "",
    visitCategory: "",
    visitVariant: "",
    quantity: 1,
    visitDate: new Date().toISOString().slice(0, 10),
    receiptNumber: "",
    notes: "",
  });
  const [submitState, setSubmitState] = useState({
    loading: false,
    error: "",
    success: "",
    dashboardUrl: "",
    shareMessage: "",
    progress: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadBookings() {
      try {
        const response = await fetch("/api/admin/bookings", { cache: "no-store" });
        const data = await response.json();

        if (!mounted) {
          return;
        }

        setBookingState({
          loading: false,
          configured: data.configured,
          message: data.message,
          items: data.items || [],
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setBookingState({
          loading: false,
          configured: false,
          message: error.message || "Unable to load bookings.",
          items: [],
        });
      }
    }

    async function loadLoyaltyVisits() {
      try {
        const response = await fetch("/api/admin/loyalty", { cache: "no-store" });
        const data = await response.json();

        if (!mounted) {
          return;
        }

        setLoyaltyState({
          loading: false,
          configured: data.configured,
          message: data.message,
          items: data.items || [],
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setLoyaltyState({
          loading: false,
          configured: false,
          message: error.message || "Unable to load loyalty visits.",
          items: [],
        });
      }
    }

    loadBookings();
    loadLoyaltyVisits();

    return () => {
      mounted = false;
    };
  }, []);

  function updateLoyaltyField(key, value) {
    setLoyaltyForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function selectLoyaltyCategory(value) {
    setLoyaltyForm((current) => ({
      ...current,
      visitCategory: value,
      visitVariant: "",
    }));
  }

  function changeLoyaltyQuantity(nextValue) {
    setLoyaltyForm((current) => ({
      ...current,
      quantity: Math.min(10, Math.max(1, nextValue)),
    }));
  }

  async function handleLoyaltySubmit(event) {
    event.preventDefault();
    setSubmitState({
      loading: true,
      error: "",
      success: "",
      dashboardUrl: "",
      shareMessage: "",
      progress: null,
    });

    try {
      const shoeType = getLoyaltyVisitLabel(loyaltyForm);

      if (!shoeType) {
        setSubmitState({
          loading: false,
          error: "Choose the shoe category, treatment option, and quantity first.",
          success: "",
          dashboardUrl: "",
          shareMessage: "",
          progress: null,
        });
        return;
      }

      const response = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...loyaltyForm,
          shoeType,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.saved) {
        setSubmitState({
          loading: false,
          error: data.message || "Unable to save loyalty visit.",
          success: "",
          dashboardUrl: "",
          shareMessage: "",
          progress: null,
        });
        return;
      }

      setSubmitState({
        loading: false,
        error: "",
        success: data.message,
        dashboardUrl: data.dashboardUrl,
        shareMessage: data.shareMessage,
        progress: data.progress,
      });
      setLoyaltyForm((current) => ({
        ...current,
        visitCategory: "",
        visitVariant: "",
        quantity: 1,
        receiptNumber: "",
        notes: "",
      }));

      const loyaltyResponse = await fetch("/api/admin/loyalty", { cache: "no-store" });
      const loyaltyData = await loyaltyResponse.json();
      setLoyaltyState({
        loading: false,
        configured: loyaltyData.configured,
        message: loyaltyData.message,
        items: loyaltyData.items || [],
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error: error.message || "Unable to save loyalty visit.",
        success: "",
        dashboardUrl: "",
        shareMessage: "",
        progress: null,
      });
    }
  }

  const filteredVariantOptions = loyaltyVariantOptions.filter(
    (item) => item.category === loyaltyForm.visitCategory,
  );
  const visitSummaryLabel = getLoyaltyVisitLabel(loyaltyForm);

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[32px] border border-[#1f4b8f]/14 bg-white p-8 shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/cleanstep-logo-system.png"
                  alt="Cleanstep logo"
                  width={84}
                  height={84}
                  className="h-20 w-20 object-contain p-1"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#1f4b8f]">Admin operations</p>
                <h1 className="mt-2 text-3xl font-semibold text-[#3f363a]">Manage loyalty visits and bookings</h1>
                <p className="mt-2 max-w-2xl text-sm text-[#5c5357]">
                  This is the operations side for Cleanstep. Booking operations stay separate from
                  the loyalty tracker so you can manage both systems cleanly.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Loyalty visit logger</p>
              <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">Start from the admin side</h2>
              <p className="mt-2 text-sm text-[#5c5357]">
                Add the customer visit here first. Once it is saved, the customer dashboard updates automatically.
              </p>

              <form onSubmit={handleLoyaltySubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]" htmlFor="customerName">
                    Customer name
                  </label>
                  <input
                    id="customerName"
                    value={loyaltyForm.customerName}
                    onChange={(event) => updateLoyaltyField("customerName", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                    placeholder="Customer full name"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]" htmlFor="whatsAppNumber">
                    WhatsApp number
                  </label>
                  <input
                    id="whatsAppNumber"
                    value={loyaltyForm.whatsAppNumber}
                    onChange={(event) => updateLoyaltyField("whatsAppNumber", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                    placeholder="e.g. 069 110 2046"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]">
                    Shoe category
                  </label>
                  <div className="mt-2 grid gap-3">
                    {loyaltyCategoryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => selectLoyaltyCategory(option.value)}
                        className={classNames(
                          "rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition",
                          loyaltyForm.visitCategory === option.value
                            ? "border-[#1f4b8f] bg-[#eef4ff] text-[#1f4b8f]"
                            : "border-[#1f4b8f]/12 bg-white text-[#3f363a] hover:bg-[#f8fbff]",
                        )}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]">
                    Treatment / shoe option
                  </label>
                  <div className="mt-2 grid gap-3">
                    {filteredVariantOptions.length > 0 ? (
                      filteredVariantOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateLoyaltyField("visitVariant", option.value)}
                          className={classNames(
                            "rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition",
                            loyaltyForm.visitVariant === option.value
                              ? "border-[#1f4b8f] bg-[#eef4ff] text-[#1f4b8f]"
                              : "border-[#1f4b8f]/12 bg-white text-[#3f363a] hover:bg-[#f8fbff]",
                          )}
                        >
                          {option.name}
                        </button>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-sm text-[#7b7276]">
                        Choose the shoe category first.
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]">
                    Quantity
                  </label>
                  <div className="mt-2 rounded-[28px] border border-[#1f4b8f]/12 bg-[#f8fbff] p-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => changeLoyaltyQuantity((Number(loyaltyForm.quantity) || 1) - 1)}
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1f4b8f]/12 bg-white text-3xl font-light text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                      >
                        -
                      </button>
                      <div className="flex-1 rounded-[24px] border border-[#1f4b8f]/12 bg-white px-4 py-5 text-center">
                        <p className="text-4xl font-semibold text-[#3f363a]">{loyaltyForm.quantity}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[#7b7276]">
                          item{Number(loyaltyForm.quantity) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => changeLoyaltyQuantity((Number(loyaltyForm.quantity) || 1) + 1)}
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1f4b8f]/12 bg-white text-3xl font-light text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                {visitSummaryLabel && (
                  <div className="rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Current visit</p>
                    <p className="mt-2 font-semibold">{visitSummaryLabel}</p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#3f363a]" htmlFor="visitDate">
                      Visit date
                    </label>
                    <input
                      id="visitDate"
                      type="date"
                      value={loyaltyForm.visitDate}
                      onChange={(event) => updateLoyaltyField("visitDate", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#3f363a]" htmlFor="receiptNumber">
                      Receipt number
                    </label>
                    <input
                      id="receiptNumber"
                      value={loyaltyForm.receiptNumber}
                      onChange={(event) => updateLoyaltyField("receiptNumber", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                      placeholder="Receipt number"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#3f363a]" htmlFor="notes">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    value={loyaltyForm.notes}
                    onChange={(event) => updateLoyaltyField("notes", event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                    placeholder="Optional admin notes"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitState.loading}
                  className="w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
                >
                  {submitState.loading ? "Saving loyalty visit..." : "Save loyalty visit"}
                </button>
              </form>

              {submitState.error && (
                <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                  {submitState.error}
                </div>
              )}

              {submitState.success && (
                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#3f363a]">
                  <p className="font-semibold text-[#1f4b8f]">{submitState.success}</p>
                  {submitState.progress && (
                    <>
                      <p className="mt-2">
                        Total visits: {submitState.progress.totalVisits}. Qualifying visits:{" "}
                        {submitState.progress.qualifyingVisits}. Visits left until free wash:{" "}
                        {submitState.progress.visitsLeft}.
                      </p>
                      <p className="mt-1 text-[#5c5357]">
                        Only visits with 2 or more shoes count toward the 5-visit free wash reward.
                      </p>
                    </>
                  )}
                  {submitState.dashboardUrl && (
                    <div className="mt-3 space-y-2">
                      <p className="break-all text-[#1f4b8f]">{submitState.dashboardUrl}</p>
                      <textarea
                        readOnly
                        value={submitState.shareMessage}
                        className="min-h-32 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a]"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Recent loyalty visits</p>
              <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">What has been logged</h2>
              <p className="mt-2 text-sm text-[#5c5357]">
                These are the latest loyalty entries that will appear in the customer dashboard.
              </p>

              {loyaltyState.loading ? (
                <div className="mt-6 rounded-3xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-6 text-[#7b7276]">
                  Loading loyalty visits...
                </div>
              ) : loyaltyState.items.length > 0 ? (
                <div className="mt-6 grid gap-4">
                  {loyaltyState.items.map((visit) => (
                    <LoyaltyVisitCard key={visit.id} visit={visit} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-6">
                  <p className="text-lg font-semibold text-[#3f363a]">No loyalty visits yet</p>
                  <p className="mt-2 text-sm text-[#5c5357]">
                    {loyaltyState.message ||
                      "The first logged shoe drop-off will appear here automatically."}
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Booking operations</p>
              <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">Existing booking records</h2>
            </div>

          {bookingState.loading ? (
            <div className="mt-8 rounded-3xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-6 text-[#7b7276]">
              Loading bookings...
            </div>
          ) : bookingState.items.length > 0 ? (
            <div className="mt-8 grid gap-4">
              {bookingState.items.map((booking) => (
                <BookingCard key={booking.id || booking.booking_code} booking={booking} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-6">
              <p className="text-lg font-semibold text-[#3f363a]">No bookings yet</p>
              <p className="mt-2 text-sm text-[#5c5357]">
                {bookingState.message ||
                  "When a customer completes payment and the booking is saved, it will show here."}
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
