import { describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUserOrRedirect: async () => ({ id: session.id, email: "", name: "" }),
}));

// requireAdmin() is what /admin calls first (app/(app)/admin/page.tsx);
// notFound() is what turns into the 404. No database involved.
describe("requireAdmin (4.5)", () => {
  async function loadGuard(adminIds: string | undefined) {
    vi.resetModules();
    if (adminIds === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = adminIds;
    return (await import("./admin")).requireAdmin;
  }

  const is404 = (error: unknown) =>
    String((error as { digest?: string }).digest).includes("404");

  it("usuário comum recebe 404", async () => {
    session.id = "user-comum";
    const requireAdmin = await loadGuard("alguem-else, outro");
    await expect(requireAdmin()).rejects.toSatisfy(is404);
  });

  it("sem ADMIN_USER_IDS ninguém é admin", async () => {
    session.id = "qualquer";
    const requireAdmin = await loadGuard(undefined);
    await expect(requireAdmin()).rejects.toSatisfy(is404);
  });

  it("admin listado passa", async () => {
    session.id = "dono";
    const requireAdmin = await loadGuard("fulano, dono ");
    await expect(requireAdmin()).resolves.toMatchObject({ id: "dono" });
  });
});
