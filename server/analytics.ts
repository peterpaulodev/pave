import "server-only";
import { after } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EventMap } from "@/lib/analytics/events";

/** Runs `write` inside `after()` and swallows every failure — including
 * `after()` itself throwing outside a request scope — so tracking can never
 * break the caller (design.md D2). */
function scheduleWrite(label: string, write: () => Promise<unknown>): void {
  try {
    after(async () => {
      try {
        await write();
      } catch (error) {
        console.error(`[analytics] falha ao gravar ${label}`, error);
      }
    });
  } catch (error) {
    console.error(`[analytics] falha ao agendar ${label}`, error);
  }
}

/**
 * Records a product event (design.md D2). Runs inside `after()`, so the write
 * happens once the response is sent, and never throws: a failed write — or
 * calling it outside a request scope, where `after()` itself throws — is
 * logged and swallowed, so tracking can't break the user's action.
 *
 * `name` must be a key of EventMap and `props` its matching shape; anything
 * else is a type error.
 */
export function trackEvent<N extends keyof EventMap>(
  userId: string,
  name: N,
  props: EventMap[N]
): void {
  scheduleWrite(`o evento ${name}`, () =>
    prisma.event.create({
      data: { userId, name, props: props as Prisma.InputJsonObject },
    })
  );
}

/** Same guarantees as `trackEvent`, for several events of the same name and
 * user in a single `createMany` (recurring expenses, reminder batches).
 * `userIds` and `propsList` line up one to one when `userIds` is an array. */
export function trackEvents<N extends keyof EventMap>(
  userIds: string | string[],
  name: N,
  propsList: EventMap[N][]
): void {
  if (propsList.length === 0) return;
  scheduleWrite(`${propsList.length}x ${name}`, () =>
    prisma.event.createMany({
      data: propsList.map((props, index) => ({
        userId: typeof userIds === "string" ? userIds : userIds[index],
        name,
        props: props as Prisma.InputJsonObject,
      })),
    })
  );
}
