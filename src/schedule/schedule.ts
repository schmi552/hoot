/** Length of a span in whole minutes. */
export function minutesBetween(startUtc: number, endUtc: number): number {
  return Math.round((endUtc - startUtc) / 60);
}
