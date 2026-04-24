"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  buildContactEmailUrl,
  buildContactWhatsAppUrl,
  cleanstepContact,
} from "../lib/cleanstep-contact";
import {
  buildEnquiryCopy,
  buildBookingSnapshot,
  calculateBookingPricing,
  decodeBookingSelections,
  formatCurrency,
  getServiceCheckoutMode,
  getServiceById,
  isCarpetCallout,
} from "../lib/booking";

export default function SummaryClient() {
  const params = useSearchParams();
  const serviceId = params.get("service");
  const selections = decodeBookingSelections(params.get("data"));
  const service = getServiceById(serviceId);
  const checkoutMode = getServiceCheckoutMode(serviceId);
  const pricing = calculateBookingPricing(serviceId, selections);
  const bookingSnapshot = buildBookingSnapshot(serviceId, selections);
  const enquiry = buildEnquiryCopy(serviceId, selections);
  const contactEmailUrl = buildContactEmailUrl({
    subject: enquiry.subject,
    body: enquiry.body,
  });
  const contactWhatsAppUrl = buildContactWhatsAppUrl(
    enquiry.body.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactState, setContactState] = useState({
    open: false,
    booking: null,
    email: null,
    message: "",
  });
  const [showFootwearContactOptions, setShowFootwearContactOptions] = useState(false);
  const isLooseCarpetDropOff = serviceId === "carpets" && !isCarpetCallout(selections);
  const isCalloutBooking =
    serviceId === "upholstery" || (serviceId === "carpets" && isCarpetCallout(selections));
  const isConfirmFlow = serviceId === "carpets" || serviceId === "upholstery";
  const showDirectFootwearOptions = serviceId === "footwear";

  const handlePrimaryAction = async () => {
    setLoading(true);
    setError("");

    try {
      if (checkoutMode === "payment") {
        const response = await fetch("/api/paystack-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: bookingSnapshot.customerEmail,
            deposit: bookingSnapshot.deposit,
            booking: bookingSnapshot,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to start payment.");
        }

        globalThis.location.assign(data.url);
        return;
      }

      if (serviceId === "footwear" || isLooseCarpetDropOff) {
        setContactState({
          open: true,
          booking: null,
          email: null,
          message:
            serviceId === "footwear"
              ? "Choose how you want to contact Cleanstep about this footwear enquiry."
              : "Choose how you want to confirm this carpet enquiry with Cleanstep.",
        });
        setShowFootwearContactOptions(true);
        setLoading(false);
        return;
      }

      setContactState({
        open: true,
        booking: bookingSnapshot,
        email: null,
        message:
          serviceId === "carpets"
            ? "Choose how you want to confirm this carpet booking with Cleanstep."
            : "Choose how you want to confirm this booking with Cleanstep.",
      });
      setShowFootwearContactOptions(false);
      setLoading(false);
    } catch (nextError) {
      setError(nextError.message || "Unable to continue.");
      setLoading(false);
    }
  };

  const actionLabel =
    checkoutMode === "payment"
      ? "Pay 30% Deposit"
      : isConfirmFlow
        ? "Confirm Booking"
        : serviceId === "footwear" || isLooseCarpetDropOff
          ? "Show Contact Options"
          : "Confirm Booking";
  const actionLoadingLabel =
    checkoutMode === "payment"
      ? "Redirecting to payment..."
      : serviceId === "footwear" || isLooseCarpetDropOff
        ? "Opening contact options..."
        : "Preparing booking details...";
  const actionDisabled =
    selections.length === 0 ||
    pricing.total === 0 ||
    (checkoutMode === "payment" && !bookingSnapshot.customerEmail);
  const showDirectConfirmOptions = isCalloutBooking;

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-[28px] border border-[#1f4b8f]/14 bg-white p-6 shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <div className="flex items-center justify-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
              <Image
                src="/cleanstep-logo-system.png"
                alt="Cleanstep logo"
                width={52}
                height={52}
                className="h-[52px] w-[52px] object-contain p-1"
              />
            </div>
            <p className="text-center text-xs uppercase tracking-[0.24em] text-[#7b7276]">
              Booking summary
            </p>
          </div>

          <h1 className="mt-4 text-center text-3xl font-semibold">
            {service?.title || "Cleanstep service"}
          </h1>

          <div className="mt-6 rounded-2xl border border-[#1f4b8f]/10 bg-[#f9fafc] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Selections</p>
            <div className="mt-3 space-y-3">
              {selections.length > 0 ? (
                selections.map((item, index) => (
                  <div
                    key={`${item.key}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-[#4a4145]">{item.name}</span>
                    <span className="font-semibold text-[#1f4b8f]">
                      {item.displayValue ||
                        item.priceLabel ||
                        (typeof item.price === "number"
                          ? formatCurrency(item.price)
                          : item.pricingType === "quote"
                            ? "Quote required"
                            : item.value)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#7b7276]">
                  No booking selections were found for this summary.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#1f4b8f]/18 bg-[#eef4ff] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Pricing</p>
            <div className="mt-3 space-y-3">
              {pricing.lineItems.map((item) => (
                <div key={`${item.label}-${item.detail}`} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#4a4145]">{item.label}</p>
                    <p className="text-xs text-[#7b7276]">{item.detail}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#1f4b8f]">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-sm text-[#5c5357]">
                <span>Total</span>
                <span className="text-lg font-semibold text-[#1f4b8f]">
                  {formatCurrency(pricing.total)}
                </span>
              </div>
              {checkoutMode === "payment" ? (
                <>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#5c5357]">
                    <span>Deposit (30%)</span>
                    <span className="font-semibold text-[#e1251b]">
                      {formatCurrency(pricing.deposit)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#7b7276]">
                    <span>Remaining after deposit</span>
                    <span>{formatCurrency(pricing.remaining)}</span>
                  </div>
                </>
              ) : serviceId === "carpets" && isCalloutBooking ? null : null}
            </div>
          </div>

          {(service?.summaryNote || pricing.notes.length > 0) && (
            <div className="mt-6 space-y-2 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
              {service?.summaryNote && <p>{service.summaryNote}</p>}
              {pricing.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
              {error}
            </div>
          )}

          {showDirectConfirmOptions ? (
            <div className="mt-6 grid gap-3">
              <a
                href={contactWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#1faa52]"
              >
                Confirm via WhatsApp
              </a>
              <a
                href={contactEmailUrl}
                className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
              >
                Confirm via Email
              </a>
            </div>
          ) : showDirectFootwearOptions ? (
            <div className="mt-6 grid gap-3">
              <a
                href={contactWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#1faa52]"
              >
                Contact via WhatsApp
              </a>
              <a
                href={contactEmailUrl}
                className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
              >
                Contact via Email
              </a>
              <a
                href={cleanstepContact.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-4 text-center text-base font-semibold text-[#e1251b] transition hover:bg-[#ffe6e3]"
              >
                Locate Store
              </a>
            </div>
          ) : (
            <button
              onClick={handlePrimaryAction}
              disabled={loading || actionDisabled}
              className="mt-6 w-full rounded-2xl bg-[#e1251b] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#c41f16] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
            >
              {loading ? actionLoadingLabel : actionLabel}
            </button>
          )}

          {(serviceId === "footwear" || isLooseCarpetDropOff) &&
            !contactState.open &&
            !showDirectFootwearOptions && (
              <div className="mt-4 grid gap-3">
                <button
                  onClick={() => setShowFootwearContactOptions((current) => !current)}
                  className="rounded-2xl bg-[#1f4b8f] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#173a70]"
                >
                  Contact Us
                </button>
                <a
                  href={cleanstepContact.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-4 text-center text-base font-semibold text-[#e1251b] transition hover:bg-[#ffe6e3]"
                >
                  Locate Our Store
                </a>
                {showFootwearContactOptions && (
                  <div className="grid gap-3 rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                    <a
                      href={contactWhatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#1faa52]"
                    >
                      Contact via WhatsApp
                    </a>
                    <a
                      href={contactEmailUrl}
                      className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                    >
                      Contact via Email
                    </a>
                  </div>
                )}
              </div>
            )}

          {contactState.open && !showDirectConfirmOptions && (
            <div className="mt-6 rounded-3xl border border-[#1f4b8f]/16 bg-[#f9fafc] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[#7b7276]">Contact Cleanstep</p>
              <p className="mt-3 text-sm text-[#4a4145]">{contactState.message}</p>

              {contactState.booking?.booking_code && (
                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#4a4145]">
                  <p className="font-semibold text-[#1f4b8f]">
                    Booking code: {contactState.booking.booking_code}
                  </p>
                  {contactState.booking.booking_date && (
                    <p className="mt-2">Preferred date: {contactState.booking.booking_date}</p>
                  )}
                  {contactState.booking.location && (
                    <p className="mt-1">Location: {contactState.booking.location}</p>
                  )}
                </div>
              )}

              {!contactState.booking?.booking_code && isCalloutBooking && (
                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/12 bg-white p-4 text-sm text-[#4a4145]">
                  <p><span className="font-semibold">Name:</span> {bookingSnapshot.customerName || "Not set"}</p>
                  <p className="mt-2"><span className="font-semibold">Service:</span> {bookingSnapshot.serviceTitle}</p>
                  <p className="mt-2"><span className="font-semibold">Booking:</span> {bookingSnapshot.primaryItem}</p>
                  <p className="mt-2"><span className="font-semibold">Preferred date:</span> {bookingSnapshot.bookingDate || "Not set"}</p>
                  <p className="mt-2"><span className="font-semibold">Location:</span> {bookingSnapshot.location || "Not set"}</p>
                  <p className="mt-2"><span className="font-semibold">Phone:</span> {bookingSnapshot.customerPhone || "Not set"}</p>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {serviceId === "footwear" || isLooseCarpetDropOff ? (
                  <>
                    <button
                      onClick={() => setShowFootwearContactOptions((current) => !current)}
                      className="rounded-2xl bg-[#1f4b8f] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#173a70]"
                    >
                      Contact Us
                    </button>
                    {showFootwearContactOptions && (
                      <div className="grid gap-3 rounded-2xl border border-[#1f4b8f]/10 bg-white p-4">
                        <a
                          href={contactWhatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#1faa52]"
                        >
                          {isConfirmFlow ? "Confirm via WhatsApp" : "Contact via WhatsApp"}
                        </a>
                        <a
                          href={contactEmailUrl}
                          className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                        >
                          {isConfirmFlow ? "Confirm via Email" : "Contact via Email"}
                        </a>
                      </div>
                    )}
                  </>
                ) : isCalloutBooking ? (
                  <>
                    <a
                      href={contactWhatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#1faa52]"
                    >
                      Confirm via WhatsApp
                    </a>
                    <a
                      href={contactEmailUrl}
                      className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                    >
                      Confirm via Email
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={cleanstepContact.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-[#1f4b8f] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#173a70]"
                    >
                      WhatsApp {cleanstepContact.whatsappLabel}
                    </a>
                    <a
                      href={cleanstepContact.emailUrl}
                      className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                    >
                      Email {cleanstepContact.emailAddress}
                    </a>
                  </>
                )}
                {(serviceId === "footwear" || isLooseCarpetDropOff) && (
                  <a
                    href={cleanstepContact.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-4 text-center text-base font-semibold text-[#e1251b] transition hover:bg-[#ffe6e3]"
                  >
                    Locate Our Store
                  </a>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-[#1f4b8f]/10 bg-white p-4 text-sm text-[#5c5357]">
                <p>
                  {serviceId === "footwear" || isLooseCarpetDropOff
                    ? cleanstepContact.storeAddress
                    : "Send this booking request through WhatsApp or Email and the Cleanstep team will respond directly."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
