/**
 * Describes what a column's values look like using character classes only.
 * The result may be sent to an AI model, so it must never echo an input value.
 */

const MAX_SAMPLE = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS = /^\d+$/;
const PLUS_47_NUMBER = /^\+47[\s]?\d{8}$/;
const INTERNATIONAL_NUMBER = /^\+\d{1,3}[\s]?\d{6,12}$/;
const CAPITALIZED_WORDS = /^\p{Lu}\p{L}*(?:[ -]\p{Lu}\p{L}*)?$/u;
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;
const CITY_NAME = /\b(?:oslo|bergen|trondheim|stavanger)\b/i;
const MAX_SMALL_NUMBER_DIGITS = 2;

function digitsPhrase(values: string[]): string {
  const lengths = values.map((value) => value.length);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  if (max <= MAX_SMALL_NUMBER_DIGITS) {
    const numbers = values.map(Number);
    return `number ${Math.min(...numbers)}–${Math.max(...numbers)}`;
  }
  return min === max ? `${min} digits` : `${min}–${max} digits`;
}

export function describeValueShape(values: string[]): string {
  const sample = values
    .map((value) => value.trim())
    .filter((value) => value !== "")
    .slice(0, MAX_SAMPLE);

  if (sample.length === 0) {
    return "empty";
  }
  if (sample.every((value) => EMAIL.test(value))) {
    return "text@domain";
  }
  if (sample.every((value) => PLUS_47_NUMBER.test(value))) {
    return "+47 and 8 digits";
  }
  if (sample.every((value) => INTERNATIONAL_NUMBER.test(value))) {
    return "+ country code and digits";
  }
  if (sample.every((value) => DIGITS.test(value))) {
    return digitsPhrase(sample);
  }
  if (sample.every((value) => CAPITALIZED_WORDS.test(value))) {
    return "one or two capitalized words";
  }

  const hasLetters = sample.some((value) => HAS_LETTER.test(value));
  const hasDigits = sample.some((value) => HAS_DIGIT.test(value));
  const hasCity = sample.some((value) => CITY_NAME.test(value));
  if (hasLetters && hasDigits) {
    return hasCity
      ? "text with a city name and a number"
      : "text with a number";
  }
  if (hasCity) {
    return "text with a city name";
  }
  return hasLetters ? "free text" : "symbols and numbers";
}
