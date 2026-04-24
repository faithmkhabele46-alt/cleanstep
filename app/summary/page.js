import { Suspense } from "react";
import SummaryClient from "./SummaryClient";

export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryClient />
    </Suspense>
  );
}
