"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildContactEmailUrl,
  buildContactWhatsAppUrl,
  cleanstepContact,
} from "../lib/cleanstep-contact";
import {
  decodeBookingSelections,
  formatCurrency,
} from "../lib/booking";
import {
  buildBasketContactCopy,
  calculateBasketPricing,
  clearStoredBookingBasket,
  createBasketEntry,
  getBasketPrimaryLabel,
  getStoredBookingBasket,
} from "../lib/booking-basket";

export default function SummaryClient() {
  const params = useSearchParams();
  const [basket, setBasket] = useState(() => {
    const storedBasket = getStoredBookingBasket();

    if (storedBasket.length > 0) {
      return storedBasket;
    }

    const serviceId = params.get("service");
    const selections = decodeBookingSelections(params.get("data"));

    if (!serviceId || selections.length === 0) {
      return [];
    }

    return [createBasketEntry(serviceId, selections)];
  });

  const basketPricing = useMemo(() => calculateBasketPricing(basket), [basket]);
  const basketEnquiry = useMemo(() => buildBasketContactCopy(basket), [basket]);
  const contactEmailUrl = buildContactEmailUrl({
    subject: basketEnquiry.subject,
    body: basketEnquiry.body,
  });
  const contactWhatsAppUrl = buildContactWhatsAppUrl(
    basketEnquiry.body.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
  );
  const allDropOffItems = basketEnquiry.allDropOffItems;

  const handleClearBasket = () => {
    clearStoredBookingBasket();
    setBasket([]);
  };

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
              Combined booking summary
            </p>
          </div>

          <h1 className="mt-4 text-center text-3xl font-semibold">Your Cleanstep basket</h1>

          <div className="mt-6 rounded-2xl border border-[#1f4b8f]/10 bg-[#f9fafc] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Confirmed items</p>
              {basket.length > 0 && (
                <button
                  onClick={handleClearBasket}
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e1251b]"
                >
                  Clear basket
                </button>
              )}
            </div>

            <div className="mt-3 space-y-4">
              {basket.length > 0 ? (
                basket.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-[#1f4b8f]/10 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[#7b7276]">
                          {entry.serviceTitle}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#3f363a]">
                          {getBasketPrimaryLabel(entry)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#1f4b8f]">
                        {formatCurrency(entry.pricing?.total || 0)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(entry.selections || []).map((item, index) => (
                        <div
                          key={`${entry.id}-${item.key}-${index}`}
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
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#7b7276]">
                  No confirmed items are in the basket yet.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#1f4b8f]/18 bg-[#eef4ff] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Pricing</p>
            <div className="mt-3 space-y-3">
              {basketPricing.lineItems.map((item, index) => (
                <div key={`${item.serviceId}-${item.label}-${index}`} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#4a4145]">{item.label}</p>
                    <p className="text-xs text-[#7b7276]">
                      {item.serviceTitle}
                      {item.detail ? ` • ${item.detail}` : ""}
                    </p>
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
                  {formatCurrency(basketPricing.total)}
                </span>
              </div>
            </div>
          </div>

          {basketPricing.notes.length > 0 && (
            <div className="mt-6 space-y-2 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
              {basketPricing.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-3">
            <Link
              href="/"
              className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
            >
              Add Another Service
            </Link>
            <a
              href={contactWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-[#1faa52]"
            >
              {basketEnquiry.hasCalloutItem ? "Confirm via WhatsApp" : "Contact via WhatsApp"}
            </a>
            <a
              href={contactEmailUrl}
              className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-base font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
            >
              {basketEnquiry.hasCalloutItem ? "Confirm via Email" : "Contact via Email"}
            </a>
            {allDropOffItems && (
              <a
                href={cleanstepContact.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-4 text-center text-base font-semibold text-[#e1251b] transition hover:bg-[#ffe6e3]"
              >
                Locate Store
              </a>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[#1f4b8f]/10 bg-white p-4 text-sm text-[#5c5357]">
            <p>
              {allDropOffItems
                ? cleanstepContact.storeAddress
                : "Send this combined booking request through WhatsApp or Email and the Cleanstep team will respond directly."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
