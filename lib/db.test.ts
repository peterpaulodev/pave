import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PrismaClientMock = vi.fn().mockImplementation(function (
  this: { $queryRaw: unknown }
) {
  this.$queryRaw = vi.fn();
});

vi.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: PrismaClientMock,
}));

vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: vi.fn().mockImplementation(function (
    this: { connectionString: string },
    opts: { connectionString: string }
  ) {
    this.connectionString = opts.connectionString;
  }),
}));

function clearGlobalPrismaCache() {
  delete (globalThis as { prisma?: unknown }).prisma;
}

describe("lib/db", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    PrismaClientMock.mockClear();
    clearGlobalPrismaCache();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    clearGlobalPrismaCache();
  });

  it("throws an error naming DATABASE_URL when it is not set", async () => {
    delete process.env.DATABASE_URL;
    const { prisma } = await import("@/lib/db");

    expect(() => prisma.$queryRaw).toThrowError(/DATABASE_URL/);
  });

  it("does not construct a client just by importing the module", async () => {
    delete process.env.DATABASE_URL;
    await import("@/lib/db");

    expect(PrismaClientMock).not.toHaveBeenCalled();
  });

  it("reuses the same client across module reloads (hot-reload safety)", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@ep-example-pooler.neon.tech/db?sslmode=require";

    const { prisma: prisma1 } = await import("@/lib/db");
    void prisma1.$queryRaw; // force lazy instantiation

    // Simulate `next dev` hot-reloading this module: the module registry is
    // cleared and lib/db.ts is re-evaluated from scratch, but the client
    // cached on globalThis should survive.
    vi.resetModules();

    const { prisma: prisma2 } = await import("@/lib/db");
    void prisma2.$queryRaw;

    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
  });
});
