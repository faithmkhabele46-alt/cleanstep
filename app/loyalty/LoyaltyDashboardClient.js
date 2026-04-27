"use client";

import Image from "next/image";
import { useState } from "react";

function VisitCard({ visit }) {
  return (
    <div className="rounded-2xl border border-[#1f4b8f]/10 bg-white p-4 shadow-[0_16px_40px_rgba(31,75,143,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#3f363a]">{visit.shoeType}</h3>
          <p className="mt-1 text-sm text-[#5c5357]">{visit.visitDate}</p>
        </div>
        {visit.receiptNumber && (
          <span className="rounded-full border border-[#1f4b8f]/12 bg-[#eef4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f4b8f]">
            {visit.receiptNumber}
          </span>
        )}
      </div>
      {visit.notes && <p className="mt-3 text-sm text-[#5c5357]">{visit.notes}</p>}
    </div>
  );
}

export default function LoyaltyDashboardClient({
  initialPhone = "",
  initialCustomer = null,
  initialProgress = null,
  initialVisits = [],
  initialError = "",
  initialStatus = {
    found: false,
    hasAccount: false,
    message: "",
    customer: null,
  },
  initiallyAuthenticated = false,
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState(
    initiallyAuthenticated
      ? "dashboard"
      : initialStatus.found
        ? initialStatus.hasAccount
          ? "login"
          : "register"
        : "lookup",
  );
  const [state, setState] = useState({
    loading: false,
    error: initialError,
    customer: initialCustomer,
    progress: initialProgress,
    visits: initialVisits,
  });

  async function fetchCustomer(nextPhone) {
    try {
      const response = await fetch("/api/loyalty/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsAppNumber: nextPhone }),
      });
      const data = await response.json();

      if (!response.ok || !data.found) {
        setState({
          loading: false,
          error: data.message || "No loyalty profile was found.",
          customer: null,
          progress: null,
          visits: [],
        });
        return;
      }

      setState({
        loading: false,
        error: "",
        customer: data.customer,
        progress: data.progress,
        visits: data.visits || [],
      });
      setMode("dashboard");
    } catch (error) {
      setState({
        loading: false,
        error: error.message || "Unable to load the loyalty profile.",
        customer: null,
        progress: null,
        visits: [],
      });
    }
  }

  async function checkLoyaltyStatus(event) {
    event?.preventDefault();
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch("/api/loyalty/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsAppNumber: phone }),
      });
      const data = await response.json();

      if (!response.ok || !data.found) {
        setState((current) => ({
          ...current,
          loading: false,
          error: data.message || "No loyalty profile was found.",
        }));
        setMode("lookup");
        return;
      }

      setPhone(data.customer.whatsAppNumber);
      setPassword("");
      setConfirmPassword("");
      setState((current) => ({
        ...current,
        loading: false,
        error: "",
      }));
      setMode(data.hasAccount ? "login" : "register");
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message || "Unable to check loyalty status.",
      }));
    }
  }

  async function registerLoyaltyAccount(event) {
    event.preventDefault();
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch("/api/loyalty/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsAppNumber: phone,
          password,
          confirmPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.registered) {
        setState((current) => ({
          ...current,
          loading: false,
          error: data.message || "Unable to create the loyalty account.",
        }));
        return;
      }

      setPassword("");
      setConfirmPassword("");
      await fetchCustomer(phone);
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message || "Unable to create the loyalty account.",
      }));
    }
  }

  async function signInToLoyalty(event) {
    event.preventDefault();
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch("/api/loyalty/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsAppNumber: phone,
          password,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.signedIn) {
        setState((current) => ({
          ...current,
          loading: false,
          error: data.message || "Unable to sign in.",
        }));
        return;
      }

      setPassword("");
      setConfirmPassword("");
      await fetchCustomer(phone);
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message || "Unable to sign in.",
      }));
    }
  }

  async function signOutOfLoyalty() {
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    await fetch("/api/loyalty/logout", {
      method: "POST",
    });

    setState({
      loading: false,
      error: "",
      customer: null,
      progress: null,
      visits: [],
    });
    setPassword("");
    setConfirmPassword("");
    setMode("lookup");
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[32px] border border-[#1f4b8f]/14 bg-white p-8 shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
              <Image
                src="/cleanstep-logo-system.png"
                alt="Cleanstep logo"
                width={88}
                height={88}
                className="h-20 w-20 object-contain p-1"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#1f4b8f]">Cleanstep loyalty</p>
              <h1 className="mt-2 text-3xl font-semibold">See your loyalty visits</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#5c5357]">
                Admin logs your shoe drop-off first. After that, you register or sign in with your
                WhatsApp number and password to see your visit history and reward progress.
              </p>
            </div>
          </div>

          {mode !== "dashboard" && (
            <div className="mt-8 rounded-3xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-5">
              {mode === "lookup" && (
                <form onSubmit={checkLoyaltyStatus}>
                  <label className="block text-sm font-semibold text-[#3f363a]" htmlFor="loyalty-phone">
                    WhatsApp number
                  </label>
                  <input
                    id="loyalty-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="e.g. 069 110 2046"
                    className="mt-3 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  />
                  <button
                    type="submit"
                    disabled={state.loading}
                    className="mt-4 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5]"
                  >
                    {state.loading ? "Checking profile..." : "Continue with WhatsApp number"}
                  </button>
                </form>
              )}

              {mode === "register" && (
                <form onSubmit={registerLoyaltyAccount}>
                  <p className="text-sm font-semibold text-[#3f363a]">Create your loyalty login</p>
                  <p className="mt-2 text-sm text-[#5c5357]">
                    This WhatsApp number has already been registered by Cleanstep. Create your password to open the dashboard.
                  </p>
                  <input
                    value={phone}
                    readOnly
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create password"
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  />
                  <button
                    type="submit"
                    disabled={state.loading}
                    className="mt-4 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5]"
                  >
                    {state.loading ? "Creating account..." : "Create loyalty account"}
                  </button>
                </form>
              )}

              {mode === "login" && (
                <form onSubmit={signInToLoyalty}>
                  <p className="text-sm font-semibold text-[#3f363a]">Sign in to your loyalty dashboard</p>
                  <p className="mt-2 text-sm text-[#5c5357]">
                    Use the WhatsApp number Cleanstep registered for you and your password.
                  </p>
                  <input
                    value={phone}
                    readOnly
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  />
                  <button
                    type="submit"
                    disabled={state.loading}
                    className="mt-4 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5]"
                  >
                    {state.loading ? "Signing in..." : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword("");
                      setConfirmPassword("");
                      setMode("register");
                      setState((current) => ({ ...current, error: "" }));
                    }}
                    className="mt-3 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                  >
                    Create account instead
                  </button>
                </form>
              )}
            </div>
          )}

          {state.error && (
            <div className="mt-6 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
              {state.error}
            </div>
          )}

          {mode === "dashboard" && state.customer && state.progress && (
            <>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-[#1f4b8f]/10 bg-[#f9fafc] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Customer</p>
                  <p className="mt-3 text-lg font-semibold">{state.customer.customerName}</p>
                  <p className="mt-1 text-sm text-[#5c5357]">{state.customer.whatsAppNumber}</p>
                </div>
                <div className="rounded-3xl border border-[#1f4b8f]/10 bg-[#eef4ff] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Total visits</p>
                  <p className="mt-3 text-3xl font-semibold text-[#1f4b8f]">
                    {state.progress.totalVisits}
                  </p>
                </div>
                <div className="rounded-3xl border border-[#e1251b]/14 bg-[#fff3f2] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Visits left</p>
                  <p className="mt-3 text-3xl font-semibold text-[#e1251b]">
                    {state.progress.visitsLeft}
                  </p>
                  <p className="mt-1 text-sm text-[#7c4642]">
                    Until reward number {state.progress.completedRewards + 1}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Visit history</p>
                  <h2 className="mt-2 text-2xl font-semibold">Every recorded Cleanstep drop-off</h2>
                </div>
                <button
                  type="button"
                  onClick={signOutOfLoyalty}
                  className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-3 text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                >
                  Sign out
                </button>
              </div>

              <div className="mt-4">
                <div className="mt-4 grid gap-4">
                  {state.visits.map((visit) => (
                    <VisitCard key={visit.id} visit={visit} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
