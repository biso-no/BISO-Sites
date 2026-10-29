// The turnover dialog needs the permission and an eligible account. Eligibility
// is computed on the server (domain check) and passed down as a boolean.
export function canShowTurnover(
  hasPermission: boolean,
  isTurnoverTarget: boolean
): boolean {
  return hasPermission && isTurnoverTarget;
}
