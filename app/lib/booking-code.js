export function generateBookingCode() {
  const value = Math.floor(10000 + Math.random() * 90000);
  return `CLN-${value}`;
}
