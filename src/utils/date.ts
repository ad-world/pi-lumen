/** Format an ISO timestamp for compact, stable display in the picker. */
export function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? isoTimestamp : date.toISOString().slice(0, 10);
}
