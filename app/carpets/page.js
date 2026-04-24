"use client";

import BookingFlow from "../components/BookingFlow";
import { services } from "../services/data";

export default function CarpetsPage() {
  return <BookingFlow service={services.carpets} />;
}
