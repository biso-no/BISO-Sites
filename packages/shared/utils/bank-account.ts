const ACCOUNT_LENGTH = 11;
const MOD11_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
const MOD11_MODULUS = 11;
const ACCOUNT_SEPARATORS = /[\s.]/g;
const ELEVEN_DIGITS = /^\d{11}$/;

/** Strips the spaces and dots people type between the groups of a Norwegian account number. */
export function normalizeBankAccount(input: string): string {
  return input.replace(ACCOUNT_SEPARATORS, "");
}

/**
 * True for a Norwegian bank account number: 11 digits whose last digit is the
 * MOD11 check digit of the first ten. The input must already be normalised.
 */
export function isValidNorwegianBankAccount(digits: string): boolean {
  if (!ELEVEN_DIGITS.test(digits) || digits.length !== ACCOUNT_LENGTH) {
    return false;
  }
  const sum = MOD11_WEIGHTS.reduce(
    (total, weight, index) => total + weight * Number(digits[index]),
    0
  );
  const remainder = sum % MOD11_MODULUS;
  if (remainder === 1) {
    return false;
  }
  const check = remainder === 0 ? 0 : MOD11_MODULUS - remainder;
  return check === Number(digits[ACCOUNT_LENGTH - 1]);
}
