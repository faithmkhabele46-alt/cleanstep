"use client";

import BookingFlow from "../components/BookingFlow";
import { services } from "../services/data";

export default function ShoesPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-8 text-[#3f363a]">
      <div className="mx-auto max-w-6xl">
        <BookingFlow service={services.footwear} />
      </div>
    </div>
  );
}
