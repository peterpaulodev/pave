import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

async function getRoute() {
  return import("./route");
}

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("returns 200 with an ok body when the database responds", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    const { GET } = await getRoute();

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({
      status: "ok",
      database: "up",
    });
  });

  it("returns 503 without leaking error details when the database rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRawMock.mockRejectedValueOnce(
      new Error(
        "connection refused at postgresql://user:secret@ep-example.neon.tech/db"
      )
    );
    const { GET } = await getRoute();

    const res = await GET();
    const bodyText = await res.text();

    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(bodyText)).toEqual({ status: "error", database: "down" });
    expect(bodyText).not.toContain("secret");
    expect(bodyText).not.toContain("neon.tech");

    consoleErrorSpy.mockRestore();
  });

  it("returns 503 when the database query times out", async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRawMock.mockImplementationOnce(() => new Promise(() => {})); // never resolves
    const { GET } = await getRoute();

    const resPromise = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const res = await resPromise;

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      status: "error",
      database: "down",
    });

    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });
});
