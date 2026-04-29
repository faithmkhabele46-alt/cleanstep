"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";
import {
  buildContactEmailUrl,
  buildContactWhatsAppUrl,
  cleanstepContact,
} from "../lib/cleanstep-contact";
import {
  buildEnquiryCopy,
  calculateBookingPricing,
  encodeBookingSelections,
  formatCurrency,
  getServiceCheckoutMode,
  getStepOptions,
  getVisibleSteps,
  isCarpetCallout,
} from "../lib/booking";
import {
  buildBasketContactCopy,
  calculateBasketPricing,
  clearStoredBookingBasket,
  createBasketEntry,
  getBasketPrimaryLabel,
  getStoredBookingBasket,
  saveStoredBookingBasket,
} from "../lib/booking-basket";

function buildNumberSelection(step, value) {
  return {
    key: step.key,
    value,
    name: `${value} ${step.unitLabel || "items"}`,
  };
}

function buildInputSelection(step, value) {
  return {
    key: step.key,
    value,
    name: step.summaryLabel || step.title,
    displayValue: value,
  };
}

function getCurrentYearDateBounds() {
  const currentYear = new Date().getFullYear();

  return {
    min: `${currentYear}-01-01`,
    max: `${currentYear}-12-31`,
  };
}

function isValidCurrentYearDate(value) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const currentYear = new Date().getFullYear();

  if (year !== currentYear || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatCurrentYearDateInput(rawValue) {
  const currentYear = new Date().getFullYear();
  const digitsOnly = String(rawValue || "").replace(/\D/g, "").slice(0, 4);
  const month = digitsOnly.slice(0, 2);
  const day = digitsOnly.slice(2, 4);

  if (!month) {
    return "";
  }

  if (digitsOnly.length <= 2) {
    return month;
  }

  if (digitsOnly.length < 4) {
    return `${month}/${day}`;
  }

  return `${month}/${day}/${currentYear}`;
}

export default function BookingFlow({ service }) {
  const router = useRouter();
  const { id: serviceId, title, steps = [], summaryNote } = service;
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState([]);
  const [numberDrafts, setNumberDrafts] = useState({});
  const [inputDrafts, setInputDrafts] = useState({});
  const [showFootwearContactOptions, setShowFootwearContactOptions] = useState(false);
  const [basket, setBasket] = useState(() => getStoredBookingBasket());
  const [itemAddedMessage, setItemAddedMessage] = useState("");

  const visibleSteps = getVisibleSteps(steps, selections);
  const safeStepIndex =
    visibleSteps.length === 0 ? 0 : Math.min(stepIndex, visibleSteps.length - 1);
  const currentStep = visibleSteps[safeStepIndex];

  if (!steps.length || !currentStep) {
    return (
      <div className="min-h-screen bg-[#07131f] px-4 py-8 text-center text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-black/30 p-6">
          <h1 className="text-xl font-bold">No service steps found</h1>
        </div>
      </div>
    );
  }

  const currentStepIndexInAll = steps.findIndex((step) => step.key === currentStep.key);
  const futureKeys = steps.slice(currentStepIndexInAll + 1).map((step) => step.key);
  const stepOptions = getStepOptions(currentStep, selections);
  const currentSelection = selections.find((selection) => selection.key === currentStep.key);
  const pricing = calculateBookingPricing(serviceId, selections);
  const basketPricing = calculateBasketPricing(basket);
  const checkoutMode = getServiceCheckoutMode(serviceId);
  const enquiry = buildEnquiryCopy(serviceId, selections);
  const basketEnquiry = buildBasketContactCopy(basket);
  const isLooseCarpetDropOff = serviceId === "carpets" && !isCarpetCallout(selections);
  const isConfirmFlow = serviceId === "carpets" || serviceId === "upholstery";
  const contactEmailUrl = buildContactEmailUrl({
    subject: enquiry.subject,
    body: enquiry.body,
  });
  const contactWhatsAppUrl = buildContactWhatsAppUrl(
    enquiry.body.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
  );
  const canContinueToSummary =
    basket.length > 0;
  const hasCalculatedPrice = pricing.lineItems.length > 0 || pricing.total > 0;
  const hasCompletedCurrentItem =
    safeStepIndex === visibleSteps.length - 1 && Boolean(currentSelection);
  const numberValue =
    numberDrafts[currentStep.key] ??
    currentSelection?.value ??
    currentStep.defaultValue ??
    currentStep.min ??
    1;
  const inputValue =
    inputDrafts[currentStep.key] ?? currentSelection?.value ?? "";
  const dateBounds = currentStep.inputType === "date" ? getCurrentYearDateBounds() : null;

  const commitSelection = (item) => {
    const preservedSelections = selections.filter(
      (selection) => selection.key !== currentStep.key && !futureKeys.includes(selection.key),
    );

    const updatedSelections = [...preservedSelections, item];
    setSelections(updatedSelections);
    setShowFootwearContactOptions(false);
    setItemAddedMessage("");

    const nextVisibleSteps = getVisibleSteps(steps, updatedSelections);

    if (safeStepIndex < nextVisibleSteps.length - 1) {
      setStepIndex(safeStepIndex + 1);
      return;
    }
  };

  const handleOptionSelect = (item) => {
    commitSelection({ key: currentStep.key, ...item });
  };

  const handleNumberContinue = () => {
    const min = currentStep.min || 1;
    const max = currentStep.max || min;
    const parsed = Number(numberValue);
    const clamped = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.round(parsed), min), max)
      : currentStep.defaultValue || min;

    setNumberDrafts((current) => ({ ...current, [currentStep.key]: clamped }));
    commitSelection(buildNumberSelection(currentStep, clamped));
  };

  const handleInputContinue = () => {
    const trimmedValue = String(inputValue || "").trim();

    if (!trimmedValue) {
      return;
    }

    if (currentStep.inputType === "date" && !isValidCurrentYearDate(trimmedValue)) {
      return;
    }

    setInputDrafts((current) => ({ ...current, [currentStep.key]: trimmedValue }));
    commitSelection(buildInputSelection(currentStep, trimmedValue));
  };

  const goBack = () => {
    if (safeStepIndex === 0) {
      return;
    }

    setStepIndex(safeStepIndex - 1);
  };

  const restart = () => {
    setStepIndex(0);
    setSelections([]);
    setNumberDrafts({});
    setInputDrafts({});
    setShowFootwearContactOptions(false);
  };

  const resetCurrentItem = () => {
    setStepIndex(0);
    setSelections([]);
    setNumberDrafts({});
    setInputDrafts({});
    setShowFootwearContactOptions(false);
  };

  const handleConfirmItem = () => {
    if (!hasCompletedCurrentItem) {
      return;
    }

    const entry = createBasketEntry(serviceId, selections);
    const nextBasket = [...basket, entry];
    setBasket(nextBasket);
    saveStoredBookingBasket(nextBasket);
    setItemAddedMessage(`${getBasketPrimaryLabel(entry)} added. You can now add another item.`);
    resetCurrentItem();
  };

  const handleRemoveBasketItem = (entryId) => {
    const nextBasket = basket.filter((entry) => entry.id !== entryId);
    setBasket(nextBasket);
    saveStoredBookingBasket(nextBasket);
  };

  const handleClearBasket = () => {
    setBasket([]);
    clearStoredBookingBasket();
    setItemAddedMessage("");
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-[#1f4b8f]/14 bg-white shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
          <div className="border-b border-[#1f4b8f]/12 bg-[linear-gradient(90deg,_rgba(225,37,27,0.12)_0%,_rgba(255,255,255,0.94)_35%,_rgba(31,75,143,0.12)_100%)] px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
                  <Image
                    src="/cleanstep-logo-system.png"
                    alt="Cleanstep logo"
                    width={56}
                    height={56}
                    className="h-14 w-14 object-contain p-1"
                  />
                </div>
                <div className="text-xs uppercase tracking-[0.24em] text-[#5c5357]">
                  <p>Cleanstep</p>
                  <p className="mt-1 text-[11px] tracking-[0.18em] text-[#1f4b8f]">Premium care</p>
                </div>
              </div>

              <span className="text-xs uppercase tracking-[0.22em] text-[#5c5357]">
                Step {safeStepIndex + 1} of {visibleSteps.length}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-[#5c5357]">{currentStep.title}</p>
            {currentStep.helperText && (
              <p className="mt-3 text-sm text-[#7b7276]">{currentStep.helperText}</p>
            )}
          </div>

          <div className="px-6 py-6">
            {itemAddedMessage && (
              <div className="mb-6 rounded-2xl border border-[#1f4b8f]/12 bg-[#eef4ff] p-4 text-sm text-[#1f4b8f]">
                {itemAddedMessage}
              </div>
            )}
            {currentStep.kind === "number" ? (
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm text-[#5c5357]">
                  {currentStep.unitLabel === "sqm"
                    ? "Enter the total carpet area to price the commercial clean."
                    : "Set the number of items you want included in this booking."}
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() =>
                      setNumberDrafts((current) => ({
                        ...current,
                        [currentStep.key]: Math.max((currentStep.min || 1), Number(numberValue || 0) - 1),
                      }))
                    }
                    className="h-14 w-14 rounded-2xl border border-[#1f4b8f]/12 bg-white text-2xl text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                  >
                    -
                  </button>

                  <div className="flex-1 rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-3">
                    <input
                      type="number"
                      min={currentStep.min}
                      max={currentStep.max}
                      value={numberValue}
                      onChange={(event) =>
                        setNumberDrafts((current) => ({
                          ...current,
                          [currentStep.key]: event.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-center text-3xl font-semibold text-[#3f363a] outline-none"
                    />
                    <p className="mt-1 text-center text-xs uppercase tracking-[0.18em] text-[#7b7276]">
                      {currentStep.unitLabel}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setNumberDrafts((current) => ({
                        ...current,
                        [currentStep.key]: Math.min((currentStep.max || 9999), Number(numberValue || 0) + 1),
                      }))
                    }
                    className="h-14 w-14 rounded-2xl border border-[#1f4b8f]/12 bg-white text-2xl text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleNumberContinue}
                  className="mt-5 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70]"
                >
                  Continue
                </button>
              </div>
            ) : currentStep.kind === "input" ? (
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <input
                  type={currentStep.inputType === "date" ? "text" : currentStep.inputType || "text"}
                  inputMode={currentStep.inputType === "date" ? "numeric" : undefined}
                  value={inputValue}
                  min={dateBounds?.min}
                  max={dateBounds?.max}
                  onChange={(event) =>
                    setInputDrafts((current) => ({
                      ...current,
                      [currentStep.key]:
                        currentStep.inputType === "date"
                          ? formatCurrentYearDateInput(event.target.value)
                          : event.target.value,
                    }))
                  }
                  placeholder={
                    currentStep.inputType === "date"
                      ? `mm/dd/${new Date().getFullYear()}`
                      : currentStep.placeholder
                  }
                  className="w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none placeholder:text-[#9b9397]"
                />

                {currentStep.inputType === "date" && dateBounds && (
                  <p className="mt-3 text-sm text-[#7b7276]">
                    Enter a real date within {new Date().getFullYear()} only.
                  </p>
                )}

                <button
                  onClick={handleInputContinue}
                  disabled={
                    !String(inputValue || "").trim() ||
                    (currentStep.inputType === "date" &&
                      !isValidCurrentYearDate(String(inputValue || "").trim()))
                  }
                  className="mt-5 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
                >
                  Continue
                </button>
              </div>
            ) : currentStep.kind === "place" ? (
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <PlaceAutocompleteInput
                  value={inputValue}
                  onChange={(nextValue) =>
                    setInputDrafts((current) => ({
                      ...current,
                      [currentStep.key]: nextValue,
                    }))
                  }
                  placeholder={currentStep.placeholder}
                  className="w-full rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-base text-[#3f363a] outline-none placeholder:text-[#9b9397]"
                />

                <button
                  onClick={handleInputContinue}
                  disabled={!String(inputValue || "").trim()}
                  className="mt-5 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70] disabled:cursor-not-allowed disabled:bg-[#d8dce5] disabled:text-[#8c8488]"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {stepOptions.map((item, index) => (
                  <button
                    key={`${currentStep.key}-${item.value || item.name}-${index}`}
                    onClick={() => handleOptionSelect(item)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      currentSelection?.value === item.value
                        ? "border-[#1f4b8f] bg-[#eef4ff] shadow-[0_0_0_1px_rgba(31,75,143,0.18)]"
                        : "border-[#1f4b8f]/10 bg-white hover:border-[#1f4b8f]/32 hover:bg-[#f8fbff]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-base font-medium text-[#3f363a]">{item.name}</span>
                        {item.pricingNote && (
                          <p className="mt-1 text-xs text-[#7b7276]">{item.pricingNote}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-[#e1251b]/10 px-3 py-1 text-sm font-semibold text-[#e1251b]">
                        {item.priceLabel ||
                          (typeof item.price === "number"
                            ? formatCurrency(item.price)
                            : currentStep.key === "category" ||
                                currentStep.key === "family" ||
                                currentStep.key === "type"
                              ? "Choose"
                              : "Select")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selections.length > 0 && (
              <div className="mt-6 rounded-2xl border border-[#1f4b8f]/10 bg-[#f9fafc] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Current item</p>
                <div className="mt-3 space-y-2 text-sm text-[#4a4145]">
                  {selections.map((selection) => (
                    <div key={selection.key} className="flex items-center justify-between gap-3">
                      <span>{selection.name}</span>
                      <span className="text-right text-xs text-[#7b7276]">
                        {selection.displayValue ||
                          selection.priceLabel ||
                          (typeof selection.price === "number"
                            ? formatCurrency(selection.price)
                            : selection.pricingType === "quote"
                              ? "Quote required"
                              : selection.value)}
                      </span>
                    </div>
                  ))}
                </div>

                {hasCalculatedPrice ? (
                  <div className="mt-4 rounded-2xl border border-[#1f4b8f]/18 bg-[#eef4ff] p-4">
                    <div className="flex items-center justify-between text-sm text-[#5c5357]">
                      <span>Total</span>
                      <span className="text-lg font-semibold text-[#1f4b8f]">
                        {formatCurrency(pricing.total)}
                      </span>
                    </div>
                    {checkoutMode === "payment" ? (
                      <>
                        <div className="mt-2 flex items-center justify-between text-sm text-[#5c5357]">
                          <span>Deposit (30%)</span>
                          <span className="font-semibold text-[#e1251b]">
                            {formatCurrency(pricing.deposit)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-[#7b7276]">
                          <span>Remaining after deposit</span>
                          <span>{formatCurrency(pricing.remaining)}</span>
                        </div>
                      </>
                    ) : serviceId === "carpets" && !isLooseCarpetDropOff ? (
                      <div className="mt-2 rounded-2xl border border-[#1f4b8f]/12 bg-white p-3 text-sm text-[#5c5357]">
                        No online deposit is needed. Submit the booking request and Cleanstep will contact you directly.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[#1f4b8f]/10 bg-white p-4 text-sm text-[#7b7276]">
                    Final pricing will appear after you choose the priced carpet option on the next step.
                  </div>
                )}

                {(pricing.notes.length > 0 || summaryNote) && (
                  <div className="mt-4 space-y-2 rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] p-4 text-sm text-[#7c4642]">
                    {summaryNote && <p>{summaryNote}</p>}
                    {pricing.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                )}

                {(serviceId === "footwear" || isLooseCarpetDropOff) && hasCalculatedPrice && basket.length === 0 && (
                  <div className="mt-4 grid gap-3">
                    <button
                      onClick={() => setShowFootwearContactOptions((current) => !current)}
                      className="rounded-2xl bg-[#1f4b8f] px-4 py-4 text-center text-sm font-semibold text-white transition hover:bg-[#173a70]"
                    >
                      Contact Us
                    </button>
                    <a
                      href={cleanstepContact.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-4 text-center text-sm font-semibold text-[#e1251b] transition hover:bg-[#ffe6e3]"
                    >
                      Locate Store
                    </a>

                    {showFootwearContactOptions && (
                      <div className="grid gap-3 rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                        <a
                          href={contactWhatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl bg-[#25d366] px-4 py-4 text-center text-sm font-semibold text-white transition hover:bg-[#1faa52]"
                        >
                          {isConfirmFlow ? "Confirm via WhatsApp" : "Contact via WhatsApp"}
                        </a>
                        <a
                          href={contactEmailUrl}
                          className="rounded-2xl border border-[#1f4b8f]/12 bg-white px-4 py-4 text-center text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                        >
                          {isConfirmFlow ? "Confirm via Email" : "Contact via Email"}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {hasCompletedCurrentItem && (
              <button
                onClick={handleConfirmItem}
                className="mt-6 w-full rounded-2xl bg-[#e1251b] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#c41f16]"
              >
                Confirm Item
              </button>
            )}

            {basket.length > 0 && (
              <div className="mt-6 rounded-2xl border border-[#1f4b8f]/10 bg-[#f9fafc] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7b7276]">Booking basket</p>
                  <button
                    onClick={handleClearBasket}
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e1251b]"
                  >
                    Clear basket
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {basket.map((entry) => (
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
                        <button
                          onClick={() => handleRemoveBasketItem(entry.id)}
                          className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e1251b]"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-[#1f4b8f]">
                        {formatCurrency(entry.pricing?.total || 0)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-[#1f4b8f]/18 bg-[#eef4ff] p-4">
                  <div className="flex items-center justify-between text-sm text-[#5c5357]">
                    <span>Basket total</span>
                    <span className="text-lg font-semibold text-[#1f4b8f]">
                      {formatCurrency(basketPricing.total)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <Link
                    href="/"
                    className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-4 text-center text-sm font-semibold text-[#1f4b8f] transition hover:bg-[#eef4ff]"
                  >
                    Add Another Service
                  </Link>
                  {(serviceId === "footwear" || isLooseCarpetDropOff) && basketEnquiry.allDropOffItems && (
                    <a
                      href={cleanstepContact.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-4 text-center text-sm font-semibold text-[#e1251b] transition hover:bg-[#ffe6e3]"
                    >
                      Locate Store
                    </a>
                  )}
                </div>
              </div>
            )}

            {canContinueToSummary && (
              <button
                onClick={() => {
                  const query = encodeBookingSelections(selections);
                  router.push(`/summary?data=${query}&service=${serviceId}`);
                }}
                className="mt-6 w-full rounded-2xl bg-[#1f4b8f] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#173a70]"
              >
                View Combined Summary
              </button>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={goBack}
                disabled={safeStepIndex === 0}
                className="rounded-2xl border border-[#1f4b8f]/12 px-4 py-3 text-sm font-medium text-[#5c5357] transition hover:bg-[#f5f8ff] disabled:cursor-not-allowed disabled:text-[#b0a8ac]"
              >
                Back
              </button>
              <button
                onClick={restart}
                className="rounded-2xl border border-[#e1251b]/16 bg-[#fff3f2] px-4 py-3 text-sm font-medium text-[#e1251b] transition hover:bg-[#ffe6e3]"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
