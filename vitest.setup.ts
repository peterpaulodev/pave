import { vi } from "vitest";

// Next.js's bundler resolves `server-only` to a no-op when building for the
// server (and to a throwing module only for client bundles). Under Vitest
// there is no such bundler-level aliasing, so the package always throws —
// mock it here so server-side modules that import it can be unit tested.
vi.mock("server-only", () => ({}));
