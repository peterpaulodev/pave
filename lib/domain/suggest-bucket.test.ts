import { describe, expect, it } from "vitest";
import { suggestBucket } from "./suggest-bucket";

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
