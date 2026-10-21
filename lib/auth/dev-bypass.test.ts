import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevAuthBypassUserId } from "./dev-bypass";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getDevAuthBypassUserId", () => {
  it("fica ativo só em development com a env definida", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "dev-user-1");
    expect(getDevAuthBypassUserId()).toBe("dev-user-1");
  });

  it("é ignorado em production mesmo com a env definida", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "dev-user-1");
    expect(getDevAuthBypassUserId()).toBeNull();
  });

  it("é ignorado em test e em NODE_ENV desconhecido", () => {
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "dev-user-1");
    vi.stubEnv("NODE_ENV", "test");
    expect(getDevAuthBypassUserId()).toBeNull();
    vi.stubEnv("NODE_ENV", "staging");
    expect(getDevAuthBypassUserId()).toBeNull();
  });

  it("não faz nada em development sem a env (ou vazia)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "");
    expect(getDevAuthBypassUserId()).toBeNull();
    vi.stubEnv("DEV_AUTH_BYPASS_USER_ID", "   ");
    expect(getDevAuthBypassUserId()).toBeNull();
  });
});
