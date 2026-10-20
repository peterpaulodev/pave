export async function register() {
  // Importing lib/env triggers its top-level zod validation, which throws
  // immediately (naming the missing variable) if the server is starting
  // without the environment it needs.
  await import("@/lib/env");
}
