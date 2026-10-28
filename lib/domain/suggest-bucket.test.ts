import { describe, expect, it } from "vitest";
import { normalizeText, suggestBucket } from "./suggest-bucket";

describe("suggestBucket", () => {
  it("sugere needs para mercado", () => {
    expect(suggestBucket("mercado")).toBe("needs");
  });

  it("sugere wants para ifood", () => {
    expect(suggestBucket("ifood")).toBe("wants");
  });

  it("sugere savings para tesouro", () => {
    expect(suggestBucket("tesouro")).toBe("savings");
  });

  it("retorna null sem match", () => {
    expect(suggestBucket("xpto123")).toBeNull();
  });

  it("ignora acentos", () => {
    expect(suggestBucket("açougue")).toBe("needs");
  });
});

describe("normalizeText", () => {
  it("põe em minúsculas e remove acentos, sem mexer no resto", () => {
    expect(normalizeText("Açougue DO Zé 10")).toBe("acougue do ze 10");
  });
});
