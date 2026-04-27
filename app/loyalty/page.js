import LoyaltyDashboardClient from "./LoyaltyDashboardClient";
import { getLoyaltyDashboardData, getLoyaltyCustomerStatus } from "../lib/loyalty-server";
import { getAuthenticatedLoyaltyCustomer } from "../lib/loyalty-auth";

export default async function LoyaltyPage({ searchParams }) {
  const params = await searchParams;
  const initialPhone =
    typeof params?.phone === "string" ? params.phone : "";
  const authenticatedCustomer = await getAuthenticatedLoyaltyCustomer();
  const dashboardData = authenticatedCustomer
    ? await getLoyaltyDashboardData(authenticatedCustomer.whatsAppNumber)
    : {
        found: false,
        message: "",
        customer: null,
        progress: null,
        visits: [],
      };
  const initialStatus =
    !authenticatedCustomer && initialPhone
      ? await getLoyaltyCustomerStatus(initialPhone)
      : {
          found: false,
          hasAccount: false,
          message: "",
          customer: null,
        };

  return (
    <LoyaltyDashboardClient
      initialPhone={initialPhone}
      initialCustomer={dashboardData.customer}
      initialProgress={dashboardData.progress}
      initialVisits={dashboardData.visits}
      initialError={authenticatedCustomer ? dashboardData.message : initialStatus.message}
      initialStatus={initialStatus}
      initiallyAuthenticated={Boolean(authenticatedCustomer && dashboardData.found)}
    />
  );
}
