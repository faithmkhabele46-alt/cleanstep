"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/booking";

function LoyaltyVisitCard({ visit }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8cc4ff]">
            {visit.visitDate}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{visit.customerName}</h2>
          <p className="mt-1 text-sm text-white/55">{visit.shoeType}</p>
        </div>
        {visit.receiptNumber && (
          <span className="rounded-full border border-[#0f4e93]/25 bg-[#0f4e93]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8cc4ff]">
            {visit.receiptNumber}
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">WhatsApp</p>
          <p className="mt-2">{visit.whatsAppNumber}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Notes</p>
          <p className="mt-2">{visit.notes || "No extra notes"}</p>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ booking }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8cc4ff]">
            {booking.booking_code || "Pending code"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {booking.primary_item || booking.service_title}
          </h2>
          <p className="mt-1 text-sm text-white/55">{booking.service_title}</p>
        </div>
        <span className="rounded-full border border-[#d42828]/25 bg-[#d42828]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#ffd2d2]">
          {booking.status || "pending"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Address</p>
          <p className="mt-2">{booking.location || "Not set"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Date & Time</p>
          <p className="mt-2">
            {booking.booking_date || "Not set"}
            {booking.booking_time ? ` at ${booking.booking_time}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Customer</p>
          <p className="mt-2">{booking.customer_name || "Unknown customer"}</p>
          {booking.customer_email && <p className="mt-1 text-white/55">{booking.customer_email}</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Pricing</p>
          <p className="mt-2">Total: {formatCurrency(booking.total)}</p>
          <p className="mt-1 text-white/55">Deposit: {formatCurrency(booking.deposit)}</p>
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
    shoeType: "",
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
      const response = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loyaltyForm),
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
        shoeType: "",
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,76,150,0.32),_transparent_30%),linear-gradient(180deg,_#08111d_0%,_#0d1725_52%,_#081019_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[32px] border border-[#15467d] bg-[#0a1420]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white">
                <Image
                  src="/cleanstep-logo-system.png"
                  alt="Cleanstep logo"
                  width={84}
                  height={84}
                  className="h-20 w-20 object-contain p-1"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8cc4ff]">Admin bookings</p>
                <h1 className="mt-2 text-3xl font-semibold">See who booked, where, and when</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/60">
                  This is the operations side for Cleanstep. Booking operations stay separate from
                  the loyalty tracker so you can manage both systems cleanly.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8cc4ff]">Loyalty visit logger</p>
              <h2 className="mt-3 text-2xl font-semibold">Start from the admin side</h2>
              <p className="mt-2 text-sm text-white/60">
                Add the customer visit here first. Once it is saved, the customer dashboard updates automatically.
              </p>

              <form onSubmit={handleLoyaltySubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white" htmlFor="customerName">
                    Customer name
                  </label>
                  <input
                    id="customerName"
                    value={loyaltyForm.customerName}
                    onChange={(event) => updateLoyaltyField("customerName", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-[#8cc4ff]"
                    placeholder="Customer full name"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white" htmlFor="whatsAppNumber">
                    WhatsApp number
                  </label>
                  <input
                    id="whatsAppNumber"
                    value={loyaltyForm.whatsAppNumber}
                    onChange={(event) => updateLoyaltyField("whatsAppNumber", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-[#8cc4ff]"
                    placeholder="e.g. 069 110 2046"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white" htmlFor="shoeType">
                    Visit details
                  </label>
                  <input
                    id="shoeType"
                    value={loyaltyForm.shoeType}
                    onChange={(event) => updateLoyaltyField("shoeType", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-[#8cc4ff]"
                    placeholder="e.g. White leather shoes"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-white" htmlFor="visitDate">
                      Visit date
                    </label>
                    <input
                      id="visitDate"
                      type="date"
                      value={loyaltyForm.visitDate}
                      onChange={(event) => updateLoyaltyField("visitDate", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-[#8cc4ff]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white" htmlFor="receiptNumber">
                      Receipt number
                    </label>
                    <input
                      id="receiptNumber"
                      value={loyaltyForm.receiptNumber}
                      onChange={(event) => updateLoyaltyField("receiptNumber", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-[#8cc4ff]"
                      placeholder="Receipt number"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-white" htmlFor="notes">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    value={loyaltyForm.notes}
                    onChange={(event) => updateLoyaltyField("notes", event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition focus:border-[#8cc4ff]"
                    placeholder="Optional admin notes"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitState.loading}
                  className="w-full rounded-2xl bg-[#0f4e93] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#145cae] disabled:cursor-not-allowed disabled:bg-white/15"
                >
                  {submitState.loading ? "Saving loyalty visit..." : "Save loyalty visit"}
                </button>
              </form>

              {submitState.error && (
                <div className="mt-4 rounded-2xl border border-[#d42828]/25 bg-[#d42828]/10 p-4 text-sm text-[#ffd2d2]">
                  {submitState.error}
                </div>
              )}

              {submitState.success && (
                <div className="mt-4 rounded-2xl border border-[#0f4e93]/25 bg-[#0f4e93]/10 p-4 text-sm text-[#d7ebff]">
                  <p className="font-semibold">{submitState.success}</p>
                  {submitState.progress && (
                    <p className="mt-2">
                      Total visits: {submitState.progress.totalVisits}. Visits left until reward:{" "}
                      {submitState.progress.visitsLeft}.
                    </p>
                  )}
                  {submitState.dashboardUrl && (
                    <div className="mt-3 space-y-2">
                      <p className="break-all text-white/80">{submitState.dashboardUrl}</p>
                      <textarea
                        readOnly
                        value={submitState.shareMessage}
                        className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white/85"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8cc4ff]">Recent loyalty visits</p>
              <h2 className="mt-3 text-2xl font-semibold">What has been logged</h2>
              <p className="mt-2 text-sm text-white/60">
                These are the latest loyalty entries that will appear in the customer dashboard.
              </p>

              {loyaltyState.loading ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6 text-white/65">
                  Loading loyalty visits...
                </div>
              ) : loyaltyState.items.length > 0 ? (
                <div className="mt-6 grid gap-4">
                  {loyaltyState.items.map((visit) => (
                    <LoyaltyVisitCard key={visit.id} visit={visit} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6">
                  <p className="text-lg font-semibold">No loyalty visits yet</p>
                  <p className="mt-2 text-sm text-white/60">
                    {loyaltyState.message ||
                      "The first logged shoe drop-off will appear here automatically."}
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#8cc4ff]">Booking operations</p>
              <h2 className="mt-3 text-2xl font-semibold">Existing booking records</h2>
            </div>

          {bookingState.loading ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 text-white/65">
              Loading bookings...
            </div>
          ) : bookingState.items.length > 0 ? (
            <div className="mt-8 grid gap-4">
              {bookingState.items.map((booking) => (
                <BookingCard key={booking.id || booking.booking_code} booking={booking} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-lg font-semibold">No bookings yet</p>
              <p className="mt-2 text-sm text-white/60">
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
