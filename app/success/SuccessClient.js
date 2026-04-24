"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/booking";

export default function SuccessClient() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [state, setState] = useState({
    loading: true,
    error: "",
    booking: null,
    email: null,
    savedToDatabase: false,
  });

  useEffect(() => {
    let mounted = true;

    async function verifyPayment() {
      if (!reference) {
        if (mounted) {
          setState({
            loading: false,
            error: "No payment reference was found in the callback.",
            booking: null,
            email: null,
            savedToDatabase: false,
          });
        }
        return;
      }

      try {
        const response = await fetch("/api/paystack-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const data = await response.json();

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setState({
            loading: false,
            error: data.error || "Unable to confirm payment.",
            booking: null,
            email: null,
            savedToDatabase: false,
          });
          return;
        }

        setState({
          loading: false,
          error: "",
          booking: data.booking,
          email: data.email,
          savedToDatabase: data.savedToDatabase,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setState({
          loading: false,
          error: error.message || "Unable to confirm payment.",
          booking: null,
          email: null,
          savedToDatabase: false,
        });
      }
    }

    verifyPayment();

    return () => {
      mounted = false;
    };
  }, [reference]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,76,150,0.32),_transparent_30%),linear-gradient(180deg,_#08111d_0%,_#0d1725_52%,_#081019_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-[#15467d] bg-[#0a1420]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white">
              <Image
                src="/cleanstep-logo-system.png"
                alt="Cleanstep logo"
                width={76}
                height={76}
                className="h-[76px] w-[76px] object-contain p-1"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#8cc4ff]">Payment result</p>
              <h1 className="mt-2 text-3xl font-semibold">Booking confirmation</h1>
            </div>
          </div>

          {state.loading ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 text-white/65">
              Confirming your payment and saving the booking...
            </div>
          ) : state.error ? (
            <div className="mt-8 rounded-3xl border border-[#d42828]/25 bg-[#d42828]/10 p-6 text-[#ffd2d2]">
              <p className="text-lg font-semibold">We could not finish the booking yet.</p>
              <p className="mt-2 text-sm">{state.error}</p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-[#0f4e93]/40 bg-[#0f4e93]/14 p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8cc4ff]">
                  {state.booking?.booking_code}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{state.booking?.primary_item}</h2>
                <p className="mt-1 text-white/65">{state.booking?.service_title}</p>

                <div className="mt-5 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Address</p>
                    <p className="mt-2">{state.booking?.location || "Not set"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Date & Time</p>
                    <p className="mt-2">
                      {state.booking?.booking_date || "Not set"}
                      {state.booking?.booking_time ? ` at ${state.booking.booking_time}` : ""}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Total</p>
                    <p className="mt-2">{formatCurrency(state.booking?.total)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Deposit paid</p>
                    <p className="mt-2">{formatCurrency(state.booking?.deposit)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">
                <p>
                  {state.savedToDatabase
                    ? "Your booking has been saved to the Cleanstep admin system."
                    : "The payment was confirmed, but database saving is not configured yet."}
                </p>
                <p className="mt-2">
                  {state.email?.sent
                    ? `A confirmation email has been sent to ${state.booking?.customer_email}.`
                    : state.email?.reason ||
                      "Email confirmation is not configured yet. The booking details are shown above."}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-2xl bg-[#0f4e93] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#145cae]"
            >
              Back to Home
            </Link>
            <Link
              href="/admin"
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.04]"
            >
              Open Admin
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
