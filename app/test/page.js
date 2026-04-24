import BookingFlow from "../components/BookingFlow";

export default function Test() {
  const steps = [
    {
      title: "Step 1",
      options: [
        { name: "Option A", price: 100 },
        { name: "Option B", price: 200 },
      ],
    },
  ];

  return (
    <BookingFlow
      title="🧪 Test Service"
      steps={steps}
    />
  );
}