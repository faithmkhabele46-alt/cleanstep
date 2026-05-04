"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/booking";
import { formatLoyaltyPoints, getLoyaltyVisitPoints } from "../lib/loyalty";

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

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-2">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 pr-14 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
        placeholder={placeholder}
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

function getLoyaltyVisitLabel(form) {
  const category = loyaltyCategoryOptions.find((item) => item.value === form.visitCategory);
  const variant = loyaltyVariantOptions.find((item) => item.value === form.visitVariant);
  const quantity = Number(form.quantity) || 1;

  if (!category || !variant) {
    return "";
  }

  return `${variant.name} - ${category.name} (${quantity} item${quantity === 1 ? "" : "s"})`;
}

function buildLoyaltyVisitItem(form) {
  const category = loyaltyCategoryOptions.find((item) => item.value === form.visitCategory);
  const variant = loyaltyVariantOptions.find((item) => item.value === form.visitVariant);
  const quantity = Math.max(1, Number(form.quantity) || 1);

  if (!category || !variant) {
    return null;
  }

  return {
    id: `${variant.value}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    categoryValue: category.value,
    variantValue: variant.value,
    categoryName: category.name,
    variantName: variant.name,
    quantity,
    label: `${variant.name} - ${category.name}`,
    points: getLoyaltyVisitPoints(quantity),
  };
}

function formatVisitItemSummary(item) {
  if (!item) {
    return "";
  }

  return `${item.variantName} - ${item.categoryName} (${item.quantity} item${item.quantity === 1 ? "" : "s"})`;
}

function formatVisitItemsForSave(items = []) {
  return items
    .map((item) =>
      item.quantity > 1 ? `${item.label} x${item.quantity}` : item.label,
    )
    .join(" | ");
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
  const [loyaltySearch, setLoyaltySearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [authState, setAuthState] = useState({
    loading: true,
    configured: false,
    authenticated: false,
    message: "",
  });
  const [loginForm, setLoginForm] = useState({
    password: "",
  });
  const [loginState, setLoginState] = useState({
    loading: false,
    error: "",
  });
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
    visitItems: [],
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
  const [customerUpdateState, setCustomerUpdateState] = useState({
    loading: false,
    error: "",
    success: "",
  });

  useEffect(() => {
    let mounted = true;

    async function loadAdminData() {
      try {
        const authResponse = await fetch("/api/admin/session", { cache: "no-store" });
        const authData = await authResponse.json();

        if (!mounted) {
          return;
        }

        setAuthState({
          loading: false,
          configured: authData.configured,
          authenticated: authData.authenticated,
          message: authData.message || "",
        });

        if (!authData.authenticated) {
          setBookingState({
            loading: false,
            configured: false,
            message: "",
            items: [],
          });
          setLoyaltyState({
            loading: false,
            configured: false,
            message: "",
            items: [],
          });
          return;
        }

        const [bookingResponse, loyaltyResponse] = await Promise.all([
          fetch("/api/admin/bookings", { cache: "no-store" }),
          fetch("/api/admin/loyalty", { cache: "no-store" }),
        ]);
        const bookingData = await bookingResponse.json();
        const loyaltyData = await loyaltyResponse.json();

        setBookingState({
          loading: false,
          configured: bookingData.configured,
          message: bookingData.message,
          items: bookingData.items || [],
        });
        setLoyaltyState({
          loading: false,
          configured: loyaltyData.configured,
          message: loyaltyData.message,
          items: loyaltyData.items || [],
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setAuthState({
          loading: false,
          configured: false,
          authenticated: false,
          message: error.message || "Unable to load admin access.",
        });
        setLoyaltyState({
          loading: false,
          configured: false,
          message: error.message || "Unable to load loyalty visits.",
          items: [],
        });
        setBookingState({
          loading: false,
          configured: false,
          message: error.message || "Unable to load bookings.",
          items: [],
        });
      }
    }

    loadAdminData();

    return () => {
      mounted = false;
    };
  }, []);

  function updateLoyaltyField(key, value) {
    setLoyaltyForm((current) => ({
      ...current,
      [key]: value,
    }));
    setCustomerUpdateState({
      loading: false,
      error: "",
      success: "",
    });
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

  function addCurrentVisitItem() {
    const visitItem = buildLoyaltyVisitItem(loyaltyForm);

    if (!visitItem) {
      setSubmitState({
        loading: false,
        error: "Choose the shoe category, treatment option, and quantity first.",
        success: "",
        dashboardUrl: "",
        shareMessage: "",
        progress: null,
      });
      return false;
    }

    setLoyaltyForm((current) => ({
      ...current,
      visitItems: [...current.visitItems, visitItem],
      visitCategory: "",
      visitVariant: "",
      quantity: 1,
    }));
    setSubmitState((current) => ({
      ...current,
      error: "",
    }));

    return true;
  }

  function removeVisitItem(itemId) {
    setLoyaltyForm((current) => ({
      ...current,
      visitItems: current.visitItems.filter((item) => item.id !== itemId),
    }));
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setLoginState({
      loading: true,
      error: "",
    });

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: loginForm.password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in.");
      }

      setAuthState((current) => ({
        ...current,
        authenticated: true,
        message: "",
      }));
      setLoginForm({
        password: "",
      });
      setLoginState({
        loading: false,
        error: "",
      });

      const [bookingResponse, loyaltyResponse] = await Promise.all([
        fetch("/api/admin/bookings", { cache: "no-store" }),
        fetch("/api/admin/loyalty", { cache: "no-store" }),
      ]);
      const bookingData = await bookingResponse.json();
      const loyaltyData = await loyaltyResponse.json();

      setBookingState({
        loading: false,
        configured: bookingData.configured,
        message: bookingData.message,
        items: bookingData.items || [],
      });
      setLoyaltyState({
        loading: false,
        configured: loyaltyData.configured,
        message: loyaltyData.message,
        items: loyaltyData.items || [],
      });
    } catch (error) {
      setLoginState({
        loading: false,
        error: error.message || "Unable to sign in.",
      });
    }
  }

  async function handleAdminLogout() {
    await fetch("/api/admin/session", {
      method: "DELETE",
    });

    setAuthState((current) => ({
      ...current,
      authenticated: false,
    }));
    setLoginForm({
      password: "",
    });
    setLoginState({
      loading: false,
      error: "",
    });
    setBookingState({
      loading: false,
      configured: false,
      message: "",
      items: [],
    });
    setLoyaltyState({
      loading: false,
      configured: false,
      message: "",
      items: [],
    });
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
      const pendingVisitItem = buildLoyaltyVisitItem(loyaltyForm);
      const visitItems =
        loyaltyForm.visitItems.length > 0
          ? loyaltyForm.visitItems
          : pendingVisitItem
            ? [pendingVisitItem]
            : [];

      if (visitItems.length === 0) {
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

      const totalQuantity = visitItems.reduce((sum, item) => sum + item.quantity, 0);

      const response = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...loyaltyForm,
          shoeType: formatVisitItemsForSave(visitItems),
          quantity: totalQuantity,
          visitItems,
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
      setCustomerUpdateState({
        loading: false,
        error: "",
        success: "",
      });
      setLoyaltyForm((current) => ({
        ...current,
        visitCategory: "",
        visitVariant: "",
        quantity: 1,
        visitItems: [],
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

  async function handleCustomerUpdate() {
    if (!selectedCustomerId) {
      return;
    }

    setCustomerUpdateState({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const response = await fetch("/api/admin/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          customerName: loyaltyForm.customerName,
          whatsAppNumber: loyaltyForm.whatsAppNumber,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.message || "Unable to update customer details.");
      }

      setCustomerUpdateState({
        loading: false,
        error: "",
        success: data.message,
      });

      const loyaltyResponse = await fetch("/api/admin/loyalty", { cache: "no-store" });
      const loyaltyData = await loyaltyResponse.json();
      setLoyaltyState({
        loading: false,
        configured: loyaltyData.configured,
        message: loyaltyData.message,
        items: loyaltyData.items || [],
      });
    } catch (error) {
      setCustomerUpdateState({
        loading: false,
        error: error.message || "Unable to update customer details.",
        success: "",
      });
    }
  }

  const filteredVariantOptions = loyaltyVariantOptions.filter(
    (item) => item.category === loyaltyForm.visitCategory,
  );
  const visitSummaryLabel = getLoyaltyVisitLabel(loyaltyForm);
  const pendingVisitItem = buildLoyaltyVisitItem(loyaltyForm);
  const visitItems = loyaltyForm.visitItems;
  const totalVisitQuantity = visitItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalVisitPoints = getLoyaltyVisitPoints(totalVisitQuantity);
  const uniqueCustomers = loyaltyState.items.reduce((customers, visit) => {
    if (!visit.customerId || customers.some((customer) => customer.customerId === visit.customerId)) {
      return customers;
    }

    customers.push({
      customerId: visit.customerId,
      customerName: visit.customerName,
      whatsAppNumber: visit.whatsAppNumber,
      latestShoeType: visit.shoeType,
      latestVisitDate: visit.visitDate,
    });

    return customers;
  }, []);
  const filteredCustomers = uniqueCustomers.filter((customer) => {
    const query = loyaltySearch.trim().toLowerCase();

    if (!query) {
      return false;
    }

    return (
      customer.customerName.toLowerCase().includes(query) ||
      customer.whatsAppNumber.toLowerCase().includes(query)
    );
  });
  const selectedCustomer = uniqueCustomers.find(
    (customer) => customer.customerId === selectedCustomerId,
  );

  if (authState.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[#1f4b8f]/14 bg-white p-8 shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <p className="text-sm text-[#5c5357]">Checking admin access...</p>
        </div>
      </main>
    );
  }

  if (!authState.authenticated) {
    return (
      <main className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[#1f4b8f]/14 bg-white p-8 shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <div className="flex flex-wrap items-center gap-4">
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
              <p className="text-xs uppercase tracking-[0.28em] text-[#1f4b8f]">Admin access only</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#3f363a]">Sign in to Cleanstep admin</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#5c5357]">
                This page is now private. Only the Cleanstep team should be able to view bookings and loyalty visits.
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="mt-8 rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-6">
            <label className="text-sm font-semibold text-[#3f363a]" htmlFor="adminPassword">
              Admin password
            </label>
            <PasswordField
              id="adminPassword"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ password: event.target.value })}
              placeholder="Enter the admin password"
            />
            {loginState.error && (
              <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                {loginState.error}
              </div>
            )}
            {!authState.configured && authState.message && (
              <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                {authState.message}
              </div>
            )}
            <button
              type="submit"
              disabled={loginState.loading || !authState.configured}
              className="mt-6 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
            >
              {loginState.loading ? "Signing in..." : "Open admin dashboard"}
            </button>
          </form>
        </div>
      </main>
    );
  }

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
            <button
              type="button"
              onClick={handleAdminLogout}
              className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-5 py-3 text-sm font-semibold text-[#e1251b] transition hover:bg-[#ffe7e4]"
            >
              Log out
            </button>
          </div>

          <div className="mt-8">
            <section className="rounded-3xl border border-[#1f4b8f]/12 bg-white p-6 shadow-[0_20px_50px_rgba(31,75,143,0.08)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">Loyalty visit logger</p>
              <h2 className="mt-3 text-2xl font-semibold text-[#3f363a]">Start from the admin side</h2>
              <p className="mt-2 text-sm text-[#5c5357]">
                Add the customer visit here first. Once it is saved, the customer dashboard updates automatically.
              </p>

              <div className="mt-6 rounded-3xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-4">
                <label className="text-sm font-semibold text-[#3f363a]" htmlFor="loyaltySearch">
                  Search existing loyalty customer
                </label>
                <input
                  id="loyaltySearch"
                  value={loyaltySearch}
                  onChange={(event) => setLoyaltySearch(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-[#3f363a] outline-none transition focus:border-[#1f4b8f]"
                  placeholder="Search by name or WhatsApp number"
                />
                {selectedCustomer && (
                  <div className="mt-3 rounded-2xl border border-[#1f4b8f]/12 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#3f363a]">{selectedCustomer.customerName}</p>
                        <p className="mt-1 text-sm text-[#5c5357]">{selectedCustomer.whatsAppNumber}</p>
                        <p className="mt-1 text-xs text-[#7b7276]">
                          Last visit: {selectedCustomer.latestVisitDate} - {selectedCustomer.latestShoeType}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId("");
                          setLoyaltySearch("");
                          setCustomerUpdateState({
                            loading: false,
                            error: "",
                            success: "",
                          });
                        }}
                        className="rounded-full border border-[#1f4b8f]/12 px-3 py-1 text-xs font-semibold text-[#1f4b8f] hover:bg-[#eef4ff]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                {filteredCustomers.length > 0 ? (
                  <div className="mt-3 grid gap-3">
                    {filteredCustomers.slice(0, 6).map((customer) => (
                      <button
                        key={customer.customerId}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(customer.customerId);
                          setLoyaltyForm((current) => ({
                            ...current,
                            customerName: customer.customerName,
                            whatsAppNumber: customer.whatsAppNumber,
                          }));
                          setCustomerUpdateState({
                            loading: false,
                            error: "",
                            success: "",
                          });
                        }}
                        className={classNames(
                          "rounded-2xl border px-4 py-4 text-left transition",
                          selectedCustomerId === customer.customerId
                            ? "border-[#1f4b8f] bg-[#eef4ff]"
                            : "border-[#1f4b8f]/12 bg-white hover:bg-[#f8fbff]",
                        )}
                      >
                        <p className="text-sm font-semibold text-[#3f363a]">{customer.customerName}</p>
                        <p className="mt-1 text-sm text-[#5c5357]">{customer.whatsAppNumber}</p>
                        <p className="mt-1 text-xs text-[#7b7276]">
                          Last visit: {customer.latestVisitDate} • {customer.latestShoeType}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#7b7276]">
                    {loyaltySearch.trim()
                      ? "No matching loyalty customer found yet."
                      : "Start typing a name or WhatsApp number to load an existing customer."}
                  </p>
                )}
              </div>

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
                <button
                  type="button"
                  onClick={addCurrentVisitItem}
                  className="w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                >
                  Add shoe to this visit
                </button>
                {visitItems.length > 0 && (
                  <div className="rounded-2xl border border-[#1f4b8f]/12 bg-[#f8fbff] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Current drop-off</p>
                    <div className="mt-3 space-y-3">
                      {visitItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-[#1f4b8f]/10 bg-white p-4"
                        >
                          <div>
                            <p className="font-semibold text-[#3f363a]">{formatVisitItemSummary(item)}</p>
                            <p className="mt-1 text-sm text-[#5c5357]">
                              {item.points > 0
                                ? `${formatLoyaltyPoints(item.points)} point${item.points === 1 ? "" : "s"} from this line`
                                : "Need at least 2 shoes on this line to earn points"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVisitItem(item.id)}
                            className="rounded-full border border-[#e1251b]/16 bg-[#fff3f2] px-3 py-1 text-xs font-semibold text-[#e1251b] hover:bg-[#ffe7e4]"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#1f4b8f]/10 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                      <p className="font-semibold">
                        {totalVisitQuantity} shoe{totalVisitQuantity === 1 ? "" : "s"} in this drop-off
                      </p>
                      <p className="mt-1">
                        {formatLoyaltyPoints(totalVisitPoints)} point{totalVisitPoints === 1 ? "" : "s"} will be added for this visit.
                      </p>
                    </div>
                  </div>
                )}
                {visitSummaryLabel && (
                  <div className="rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Ready to add</p>
                    <p className="mt-2 font-semibold">{visitSummaryLabel}</p>
                    {pendingVisitItem && (
                      <p className="mt-1 text-sm text-[#5c5357]">
                        This line will add {formatLoyaltyPoints(pendingVisitItem.points)} point{pendingVisitItem.points === 1 ? "" : "s"} when you press “Add shoe to this visit”.
                      </p>
                    )}
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
                <button
                  type="button"
                  onClick={handleCustomerUpdate}
                  disabled={customerUpdateState.loading || !selectedCustomerId}
                  className="w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:bg-[#f4f6fa] disabled:text-[#9aa2b4]"
                >
                  {customerUpdateState.loading ? "Saving customer changes..." : "Update selected customer"}
                </button>
              </form>

              {submitState.error && (
                <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                  {submitState.error}
                </div>
              )}

              {customerUpdateState.error && (
                <div className="mt-4 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                  {customerUpdateState.error}
                </div>
              )}

              {customerUpdateState.success && (
                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                  {customerUpdateState.success}
                </div>
              )}

              {submitState.success && (
                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#3f363a]">
                  <p className="font-semibold text-[#1f4b8f]">{submitState.success}</p>
                  {submitState.progress && (
                    <>
                      <p className="mt-2">
                        Total visits: {submitState.progress.totalVisits}. Loyalty points:{" "}
                        {formatLoyaltyPoints(submitState.progress.totalPoints)}. Points left until free wash:{" "}
                        {formatLoyaltyPoints(submitState.progress.pointsLeft)}.
                      </p>
                      <p className="mt-1 text-[#5c5357]">
                        Cleanstep gives 1 point for every 2 shoes in the same drop-off. 3 shoes = 1.5 points, 4 shoes = 2 points, and 5 shoes = 2.5 points.
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
