"use client";

import BookingFlow from "../components/BookingFlow";
import { services } from "../services/data";

export default function CouchesPage() {
  return <BookingFlow service={services.upholstery} />;
}
