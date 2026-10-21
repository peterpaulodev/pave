import "server-only";
import { after } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EventMap } from "@/lib/analytics/events";

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
  try {
    after(async () => {
      try {
        await prisma.event.create({
          data: { userId, name, props: props as Prisma.InputJsonObject },
        });
      } catch (error) {
        console.error(`[analytics] falha ao gravar o evento ${name}`, error);
      }
    });
  } catch (error) {
    console.error(`[analytics] falha ao agendar o evento ${name}`, error);
  }
}
