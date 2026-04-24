"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/booking";

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
  const [state, setState] = useState({
    loading: true,
    configured: false,
    message: "",
    items: [],
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

        setState({
          loading: false,
          configured: data.configured,
          message: data.message,
          items: data.items || [],
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setState({
          loading: false,
          configured: false,
          message: error.message || "Unable to load bookings.",
          items: [],
        });
      }
    }

    loadBookings();

    return () => {
      mounted = false;
    };
  }, []);

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
                  This is the operations side for Cleanstep. Once payment success is wired to save
                  bookings, this page will show the service, item, address, date and time for every booking.
                </p>
              </div>
            </div>
          </div>

          {state.loading ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 text-white/65">
              Loading bookings...
            </div>
          ) : state.items.length > 0 ? (
            <div className="mt-8 grid gap-4">
              {state.items.map((booking) => (
                <BookingCard key={booking.id || booking.booking_code} booking={booking} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-lg font-semibold">No bookings yet</p>
              <p className="mt-2 text-sm text-white/60">
                {state.message ||
                  "When a customer completes payment and the booking is saved, it will show here."}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
