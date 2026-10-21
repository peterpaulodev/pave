import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { removePushSubscription, upsertPushSubscription } from "./push";

const users: string[] = [];
async function newUser() {
  const id = `test-${randomUUID()}`;
  users.push(id);
  await prisma.user.create({ data: { id, email: `${id}@example.test`, name: "T" } });
  return id;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("push subscriptions (integration)", () => {
  it("upsert por endpoint: repetir não duplica e atualiza as chaves", async () => {
    const userId = await newUser();
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await upsertPushSubscription(userId, { endpoint, p256dh: "a", auth: "b", userAgent: "UA1" });
    await upsertPushSubscription(userId, { endpoint, p256dh: "c", auth: "d", userAgent: "UA2" });

    const rows = await prisma.pushSubscription.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ p256dh: "c", auth: "d", userAgent: "UA2" });
  });

  it("um usuário pode ter vários dispositivos", async () => {
    const userId = await newUser();
    await upsertPushSubscription(userId, { endpoint: `https://push.example.test/${randomUUID()}`, p256dh: "a", auth: "b" });
    await upsertPushSubscription(userId, { endpoint: `https://push.example.test/${randomUUID()}`, p256dh: "a", auth: "b" });
    expect(await prisma.pushSubscription.count({ where: { userId } })).toBe(2);
  });

  it("o mesmo navegador entrando com outra conta move a inscrição para ela", async () => {
    const a = await newUser();
    const b = await newUser();
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await upsertPushSubscription(a, { endpoint, p256dh: "a", auth: "b" });
    await upsertPushSubscription(b, { endpoint, p256dh: "a", auth: "b" });

    expect(await prisma.pushSubscription.count({ where: { userId: a } })).toBe(0);
    expect(await prisma.pushSubscription.count({ where: { userId: b } })).toBe(1);
  });

  it("remover é escopado ao dono", async () => {
    const a = await newUser();
    const b = await newUser();
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await upsertPushSubscription(a, { endpoint, p256dh: "a", auth: "b" });

    expect(await removePushSubscription(b, endpoint)).toBe(false);
    expect(await prisma.pushSubscription.count({ where: { userId: a } })).toBe(1);
    expect(await removePushSubscription(a, endpoint)).toBe(true);
  });
});
