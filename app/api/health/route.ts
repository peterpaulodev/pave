import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Database query timed out")), ms);
    }),
  ]);
}

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    return new Response(JSON.stringify({ status: "ok", database: "up" }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return new Response(JSON.stringify({ status: "error", database: "down" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }
}
