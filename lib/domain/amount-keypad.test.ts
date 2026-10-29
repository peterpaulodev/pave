import { describe, expect, it } from "vitest";
import { MAX_CENTS, keypad, type KeypadKey } from "./amount-keypad";
import { formatBRL } from "@/lib/money";

const press = (keys: KeypadKey[], from = 0) => keys.reduce(keypad, from);
const brl = (cents: number) => formatBRL(cents).replace(/\s/g, " ");

describe("keypad", () => {
  it("1-2-0-0 evolui R$ 0,01 → R$ 0,12 → R$ 1,20 → R$ 12,00 (exemplo da spec)", () => {
    const steps: number[] = [];
    let cents = 0;
    for (const key of [1, 2, 0, 0] as const) {
      cents = keypad(cents, key);
      steps.push(cents);
    }
    expect(steps).toEqual([1, 12, 120, 1200]);
    expect(steps.map(brl)).toEqual(["R$ 0,01", "R$ 0,12", "R$ 1,20", "R$ 12,00"]);
  });

  it("00 multiplica por 100", () => {
    expect(press([5, "00"])).toBe(500);
    expect(press([1, 2, "00"])).toBe(1200);
  });

  it("00 e 0 em zero continuam em zero", () => {
    expect(press(["00"])).toBe(0);
    expect(press([0, 0, "00"])).toBe(0);
  });

  it("apagar remove o último dígito: R$ 12,00 → R$ 1,20", () => {
    expect(keypad(1200, "backspace")).toBe(120);
    expect(press([1, 2, 0, 0, "backspace", "backspace"])).toBe(12);
  });

  it("apagar em zero continua em zero", () => {
    expect(keypad(0, "backspace")).toBe(0);
    expect(keypad(5, "backspace")).toBe(0);
  });

  it("limpar volta a zero", () => {
    expect(keypad(1200, "clear")).toBe(0);
    expect(keypad(0, "clear")).toBe(0);
  });

  describe("limite de 9 dígitos", () => {
    it("com 9 dígitos, outro dígito não muda o valor", () => {
      expect(keypad(MAX_CENTS, 1)).toBe(MAX_CENTS);
      expect(keypad(123456789, 0)).toBe(123456789);
    });

    it("o máximo é R$ 9.999.999,99", () => {
      expect(MAX_CENTS).toBe(999_999_999);
      expect(brl(MAX_CENTS)).toBe("R$ 9.999.999,99");
    });

    it("8º dígito ainda entra; o 9º também", () => {
      expect(keypad(1234567, 8)).toBe(12345678);
      expect(keypad(12345678, 9)).toBe(123456789);
    });

    it("00 que estouraria o limite é ignorado por inteiro", () => {
      expect(keypad(12345678, "00")).toBe(12345678); // 10 dígitos
      expect(keypad(1234567, "00")).toBe(123456700); // 9 dígitos: cabe
    });

    it("apagar volta a aceitar dígitos", () => {
      expect(keypad(keypad(MAX_CENTS, "backspace"), 7)).toBe(999_999_997);
    });
  });
});
