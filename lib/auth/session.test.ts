import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const ensureMirroredUser = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("@/lib/auth/server", () => ({ auth: { getSession } }));
vi.mock("@/server/queries", () => ({ ensureMirroredUser }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn, // no per-request memoization in unit tests
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getSessionUserOrRedirect e o bypass de dev", () => {
  it("em production ignora DEV_AUTH_BYPASS_USER_ID e exige sessão real", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "dev-user-1");
    getSession.mockResolvedValue({ data: null });
    const { getSessionUserOrRedirect } = await import("./session");

    await expect(getSessionUserOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(getSession).toHaveBeenCalled();
    expect(ensureMirroredUser).not.toHaveBeenCalled();
  });

  it("em production com sessão real devolve o usuário da sessão, não o do bypass", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "dev-user-1");
    getSession.mockResolvedValue({
      data: { user: { id: "real-user", email: "r@example.test", name: "Real" } },
    });
    const { getSessionUserOrRedirect } = await import("./session");

    expect(await getSessionUserOrRedirect()).toMatchObject({ id: "real-user" });
  });

  it("em development com a env definida, pula a sessão e espelha o usuário", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "dev-user-1");
    const { getSessionUserOrRedirect } = await import("./session");

    expect(await getSessionUserOrRedirect()).toMatchObject({ id: "dev-user-1" });
    expect(getSession).not.toHaveBeenCalled();
    expect(ensureMirroredUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dev-user-1" })
    );
  });
});
