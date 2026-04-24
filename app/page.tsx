import Image from "next/image";
import Link from "next/link";
import { services } from "./services/data";

const serviceCards = [
  {
    id: "footwear",
    label: "Footwear Cleaning",
    accent: "from-[#0f4e93]/28 to-[#0f4e93]/8",
  },
  {
    id: "carpets",
    label: "Carpets Cleaning",
    accent: "from-[#d42828]/24 to-[#d42828]/8",
  },
  {
    id: "upholstery",
    label: "Beds, Couches & Cushions",
    accent: "from-[#0f4e93]/18 via-[#d42828]/12 to-transparent",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[32px] border border-[#1f4b8f]/18 bg-white p-8 shadow-[0_24px_80px_rgba(31,75,143,0.12)]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                  <Image
                    src="/cleanstep-logo-system.png"
                    alt="Cleanstep logo"
                    width={112}
                    height={112}
                    className="h-24 w-24 object-contain p-1 sm:h-28 sm:w-28"
                  />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[#1f4b8f]">Cleanstep Booking System</p>
                </div>
              </div>
            </div>

            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Premium cleaning bookings with step-by-step pricing.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#5c5357] sm:text-base">
              Select a service, complete the guided steps, review the price, then confirm directly
              with Cleanstep through WhatsApp or Email.
            </p>

            <div className="mt-8 grid gap-4">
              {serviceCards.map((card) => {
                const service = services[card.id];

                return (
                  <Link
                    key={card.id}
                    href={service.href}
                    className={`rounded-[28px] border border-[#1f4b8f]/12 bg-gradient-to-br ${card.accent} p-5 transition hover:-translate-y-0.5 hover:border-[#1f4b8f]/30 hover:shadow-[0_18px_40px_rgba(31,75,143,0.12)]`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold">{card.label}</h2>
                        <p className="mt-2 max-w-md text-sm text-[#5c5357]">{service.description}</p>
                      </div>
                      <span className="rounded-full border border-[#1f4b8f]/18 bg-white px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#1f4b8f]">
                        Start
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <aside className="rounded-[32px] border border-[#e1251b]/15 bg-white p-8 shadow-[0_24px_80px_rgba(225,37,27,0.08)]">
            <p className="text-xs uppercase tracking-[0.28em] text-[#e1251b]">Flow</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm font-semibold">1. Select service</p>
                <p className="mt-1 text-sm text-[#5c5357]">
                  Choose footwear, carpets, or beds, couches and cushions.
                </p>
              </div>
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm font-semibold">2. Complete the guided steps</p>
                <p className="mt-1 text-sm text-[#5c5357]">
                  Each next step depends on the previous selection so the booking stays simple and clean.
                </p>
              </div>
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm font-semibold">3. Review live pricing</p>
                <p className="mt-1 text-sm text-[#5c5357]">
                  Prices update instantly based on what was selected, including sqm pricing for commercial carpets.
                </p>
              </div>
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm font-semibold">4. Drop-off or call-out flow</p>
                <p className="mt-1 text-sm text-[#5c5357]">
                  Shoes and loose carpets guide customers to contact the shop, while call-out services collect location, date, name and phone number.
                </p>
              </div>
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm font-semibold">5. Confirm via WhatsApp or Email</p>
                <p className="mt-1 text-sm text-[#5c5357]">
                  Booking messages are already written for the customer, so they can confirm directly with Cleanstep in one tap.
                </p>
              </div>
              <div className="rounded-2xl border border-[#1f4b8f]/10 bg-[#f8fbff] p-4">
                <p className="text-sm font-semibold">6. Cleanstep receives the booking</p>
                <p className="mt-1 text-sm text-[#5c5357]">
                  The team receives the customer details, selected service, address and preferred date for follow-up.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
