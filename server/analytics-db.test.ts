import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

// Hits the real Neon database — run via `pnpm test:integration`. `after()`
// only works inside a request, so it's replaced by a collector we flush by hand.
const pending: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => {
    pending.push(cb);
  },
}));

const { trackEvent } = await import("./analytics");

describe("trackEvent (integration)", () => {
  const userIds: string[] = [];

  afterEach(async () => {
    while (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: userIds.pop()! } });
    }
  });

  async function createTestUser() {
    const id = `test-${randomUUID()}`;
    userIds.push(id);
    await prisma.user.create({
      data: { id, email: `${id}@example.test`, name: "Test User" },
    });
    return id;
  }

  it("grava o evento com props e remove tudo ao excluir o usuário", async () => {
    const userId = await createTestUser();

    trackEvent(userId, "expense_created", {
      source: "quick_entry",
      bucket: "needs",
      suggestedBucket: "needs",
      overridden: false,
    });
    await Promise.all(pending.splice(0).map((cb) => cb()));

    const events = await prisma.event.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("expense_created");
    expect(events[0].props).toEqual({
      source: "quick_entry",
      bucket: "needs",
      suggestedBucket: "needs",
      overridden: false,
    });

    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.event.count({ where: { userId } })).toBe(0);
  });
});
