"use client";

import Image from "next/image";
import { useState } from "react";

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function PasswordField({
  value,
  onChange,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-4">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 pr-16 text-base text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#1f4b8f]"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function VisitCard({ visit }) {
  return (
    <div className="rounded-[26px] border border-[#1f4b8f]/10 bg-white p-5 shadow-[0_18px_45px_rgba(31,75,143,0.08)]">
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
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#1f4b8f]/10 bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#1f4b8f]">
          {visit.quantity} item{visit.quantity === 1 ? "" : "s"}
        </span>
        <span
          className={classNames(
            "rounded-full px-3 py-1 text-xs font-semibold",
            visit.qualifies
              ? "border border-[#1f4b8f]/10 bg-[#eef4ff] text-[#1f4b8f]"
              : "border border-[#e1251b]/12 bg-[#fff3f2] text-[#e1251b]",
          )}
        >
          {visit.qualifies
            ? `${visit.points} point${visit.points === 1 ? "" : "s"} earned`
            : "Need 2 or more shoes to earn points"}
        </span>
      </div>
      {visit.notes && <p className="mt-3 text-sm text-[#5c5357]">{visit.notes}</p>}
    </div>
  );
}

function ProgressStamp({ filled, number }) {
  return (
    <div
      className={classNames(
        "flex h-14 w-14 items-center justify-center rounded-full border text-sm font-semibold transition",
        filled
          ? "border-[#1f4b8f] bg-[#1f4b8f] text-white shadow-[0_12px_28px_rgba(31,75,143,0.18)]"
          : "border-[#1f4b8f]/10 bg-white text-[#7b7276]",
      )}
    >
      {number}
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
  const [customerName, setCustomerName] = useState(initialCustomer?.customerName || "");
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
          error: "",
        }));
        setCustomerName("");
        setPassword("");
        setConfirmPassword("");
        setMode("register");
        return;
      }

      setPhone(data.customer.whatsAppNumber);
      setCustomerName(data.customer.customerName || "");
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
          customerName,
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
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[36px] border border-[#1f4b8f]/14 bg-white shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <div className="bg-[linear-gradient(120deg,rgba(225,37,27,0.08),rgba(255,255,255,0.92)_32%,rgba(31,75,143,0.10))] px-8 py-8">
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
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Your reward journey starts here</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#5c5357]">
                Admin logs your shoe drop-off first. After that, you register or sign in with your
                WhatsApp number and password to see your visit history and reward progress.
              </p>
            </div>
          </div>
          </div>

          <div className="p-8">

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
                    Create your loyalty profile with your WhatsApp number, then use the same details every time you sign in.
                  </p>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Your full name"
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  />
                  <input
                    value={phone}
                    readOnly
                    className="mt-4 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none"
                  />
                  <PasswordField
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create password"
                  />
                  <PasswordField
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
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
                  <PasswordField
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
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
              <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[30px] border border-[#1f4b8f]/10 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#eef4ff_100%)] p-6 shadow-[0_18px_45px_rgba(31,75,143,0.08)]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Loyalty progress</p>
                  <h2 className="mt-3 text-3xl font-semibold text-[#3f363a]">
                    {state.progress.pointsLeft === 0
                      ? "You unlocked your free wash"
                      : `${state.progress.pointsLeft} more point${state.progress.pointsLeft === 1 ? "" : "s"} to go`}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-[#5c5357]">
                    Cleanstep gives 1 point for every 2 shoes in the same drop-off. 3 shoes = 1.5 points, 4 shoes = 2 points, and 5 shoes = 2.5 points. Your free wash unlocks after {state.progress.rewardTarget} points.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {Array.from({ length: state.progress.rewardTarget }).map((_, index) => (
                      <ProgressStamp
                        key={`stamp-${index + 1}`}
                        number={index + 1}
                        filled={index < Math.floor(state.progress.pointsIntoCurrentReward)}
                      />
                    ))}
                  </div>

                  <div className="mt-6 h-3 overflow-hidden rounded-full bg-white shadow-inner">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#e1251b,#1f4b8f)] transition-all"
                      style={{ width: `${Math.max(8, state.progress.progressPercentage || 0)}%` }}
                    />
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-[#1f4b8f]/10 bg-white p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Customer</p>
                      <p className="mt-3 text-lg font-semibold">{state.customer.customerName}</p>
                      <p className="mt-1 text-sm text-[#5c5357]">{state.customer.whatsAppNumber}</p>
                    </div>
                    <div className="rounded-3xl border border-[#1f4b8f]/10 bg-white p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">All visits</p>
                      <p className="mt-3 text-3xl font-semibold text-[#1f4b8f]">
                        {state.progress.totalVisits}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-[#e1251b]/14 bg-[#fff3f2] p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Loyalty points</p>
                      <p className="mt-3 text-3xl font-semibold text-[#e1251b]">
                        {state.progress.totalPoints}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-[#1f4b8f]/10 bg-white p-6 shadow-[0_18px_45px_rgba(31,75,143,0.08)]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Reward rules</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">How the free wash works</h2>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                      <p className="font-semibold text-[#1f4b8f]">1. Two shoes = one point</p>
                      <p className="mt-1 text-sm text-[#5c5357]">If one drop-off has 2 shoes, you earn 1 point. Every extra shoe adds another half point.</p>
                    </div>
                    <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                      <p className="font-semibold text-[#1f4b8f]">2. Reach 5 loyalty points</p>
                      <p className="mt-1 text-sm text-[#5c5357]">As soon as your total reaches 5 points, your free wash reward is ready.</p>
                    </div>
                    <div className="rounded-2xl border border-[#e1251b]/12 bg-[#fff3f2] p-4">
                      <p className="font-semibold text-[#e1251b]">3. Watch your dashboard grow</p>
                      <p className="mt-1 text-sm text-[#7c4642]">Use this page anytime to track which visits counted and how close you are.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Visit history</p>
                  <h2 className="mt-2 text-2xl font-semibold">Every recorded Cleanstep drop-off</h2>
                  <p className="mt-1 text-sm text-[#5c5357]">
                    Each visit shows how many points it added to your reward journey.
                  </p>
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
      </div>
    </main>
  );
}
