/** Largest amount the keypad accepts: 9 digits, R$ 9.999.999,99. */
export const MAX_CENTS = 999_999_999;

export type KeypadKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "00" | "backspace" | "clear";

/**
 * Pure reducer of the amount keypad (design.md D2): the state is an integer
 * number of cents and digits enter from the cents side, like a card machine.
 * A key that would pass `MAX_CENTS` is ignored as a whole.
 */
export function keypad(cents: number, key: KeypadKey): number {
  switch (key) {
    case "clear":
      return 0;
    case "backspace":
      return Math.floor(cents / 10);
    case "00":
      return withinLimit(cents * 100, cents);
    default:
      return withinLimit(cents * 10 + key, cents);
  }
}

function withinLimit(next: number, current: number): number {
  return next > MAX_CENTS ? current : next;
}
