import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Cache the single PrismaClient instance on `globalThis` (not just a module
// -level variable) so it survives `next dev`'s hot reload, which
// re-evaluates this module — without this, every reload would open a new
// pool of connections to Neon and eventually exhaust the project's
// connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Configure-a em .env (veja .env.example)."
    );
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Exposed as a lazy proxy, not instantiated eagerly at module scope: Next.js
// evaluates route modules to collect their segment config (e.g. during
// `next build`), which would otherwise require DATABASE_URL to be set just
// to build the app. The client (and the DATABASE_URL check) is only
// created the first time a caller actually accesses it.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
