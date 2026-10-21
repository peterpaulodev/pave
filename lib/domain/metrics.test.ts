import { describe, expect, it } from "vitest";
import { formatRatio, isAdmin, parseAdminIds } from "./metrics";

describe("formatRatio", () => {
  it("mostra numerador, denominador e percentual", () => {
    expect(formatRatio(3, 5)).toBe("3/5 · 60%");
    expect(formatRatio(8, 10)).toBe("8/10 · 80%");
  });

  it("denominador zero → traço", () => {
    expect(formatRatio(0, 0)).toBe("—");
    expect(formatRatio(3, 0)).toBe("—");
  });

  it("arredonda o percentual", () => {
    expect(formatRatio(1, 3)).toBe("1/3 · 33%");
    expect(formatRatio(2, 3)).toBe("2/3 · 67%");
  });

  it("zero e 100%", () => {
    expect(formatRatio(0, 4)).toBe("0/4 · 0%");
    expect(formatRatio(4, 4)).toBe("4/4 · 100%");
  });
});

describe("parseAdminIds", () => {
  it("ignora espaços, entradas vazias e ids repetidos", () => {
    expect(parseAdminIds(" a , b,, a ,")).toEqual(["a", "b"]);
  });

  it("indefinido ou vazio → ninguém", () => {
    expect(parseAdminIds(undefined)).toEqual([]);
    expect(parseAdminIds("")).toEqual([]);
    expect(parseAdminIds("  , ,")).toEqual([]);
  });
});

describe("isAdmin", () => {
  it("reconhece um id da lista, com espaços ao redor", () => {
    expect(isAdmin("user-2", "user-1, user-2 ,user-3")).toBe(true);
  });

  it("id fora da lista → false", () => {
    expect(isAdmin("user-9", "user-1,user-2")).toBe(false);
  });

  it("env ausente ou vazia → ninguém é admin", () => {
    expect(isAdmin("user-1", undefined)).toBe(false);
    expect(isAdmin("user-1", "")).toBe(false);
    expect(isAdmin("user-1", " , ")).toBe(false);
  });

  it("userId vazio nunca é admin", () => {
    expect(isAdmin("", "a,,b")).toBe(false);
  });

  it("não faz match parcial", () => {
    expect(isAdmin("user", "user-1")).toBe(false);
  });
});
