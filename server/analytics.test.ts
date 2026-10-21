import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unit-style tests (everything mocked, no database). They live under server/
// only because that's where the module is; the root vitest config excludes
// server/**, so they run with `pnpm test:integration`.
const create = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { event: { create } } }));

let afterCallbacks: Array<() => Promise<void> | void> = [];
const afterMock = vi.fn((cb: () => Promise<void> | void) => {
  afterCallbacks.push(cb);
});
vi.mock("next/server", () => ({ after: afterMock }));

const { trackEvent } = await import("./analytics");

async function flushAfter() {
  const callbacks = afterCallbacks;
  afterCallbacks = [];
  for (const cb of callbacks) await cb();
}

describe("trackEvent", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    create.mockReset();
    afterMock.mockClear();
    afterCallbacks = [];
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  it("não grava na hora: agenda a escrita em after()", () => {
    trackEvent("u1", "reminder_sent", {});
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("grava nome, usuário e props quando o after() executa", async () => {
    create.mockResolvedValue({});
    trackEvent("u1", "expense_deleted", { wasRecurring: true });
    await flushAfter();
    expect(create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "expense_deleted", props: { wasRecurring: true } },
    });
  });

  it("falha do banco não lança: é logada", async () => {
    create.mockRejectedValue(new Error("db fora do ar"));
    expect(() => trackEvent("u1", "reminder_sent", {})).not.toThrow();
    await expect(flushAfter()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("after() fora de um request scope também não lança", () => {
    afterMock.mockImplementationOnce(() => {
      throw new Error("`after` was called outside a request scope");
    });
    expect(() => trackEvent("u1", "reminder_sent", {})).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("rejeita nome fora do EventMap e props de outro evento (tipos)", () => {
    // @ts-expect-error nome desconhecido
    trackEvent("u1", "nao_existe", {});
    // @ts-expect-error props de outro evento
    trackEvent("u1", "no_spend_checkin", { wasRecurring: true });
    // @ts-expect-error props obrigatórias ausentes
    trackEvent("u1", "reminder_enabled", {});
  });
});
