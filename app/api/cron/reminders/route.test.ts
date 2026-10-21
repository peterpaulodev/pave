import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runReminderCron } = vi.hoisted(() => ({ runReminderCron: vi.fn() }));
vi.mock("@/server/reminders", () => ({ runReminderCron }));

import { POST } from "./route";

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/reminders", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/cron/reminders", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "0123456789abcdef0123");
    runReminderCron.mockResolvedValue({ checked: 3, sent: 2, removedSubscriptions: 1 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("responde 401 sem o header e não envia nada", async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(runReminderCron).not.toHaveBeenCalled();
  });

  it("responde 401 com segredo errado (mesmo tamanho ou não)", async () => {
    expect((await POST(request("Bearer 0123456789abcdef0124"))).status).toBe(401);
    expect((await POST(request("Bearer errado"))).status).toBe(401);
    expect((await POST(request("0123456789abcdef0123"))).status).toBe(401);
    expect(runReminderCron).not.toHaveBeenCalled();
  });

  it("responde 401 quando CRON_SECRET não está configurada", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request("Bearer "))).status).toBe(401);
    expect(runReminderCron).not.toHaveBeenCalled();
  });

  it("com o segredo certo roda e devolve { checked, sent, removedSubscriptions }", async () => {
    const response = await POST(request("Bearer 0123456789abcdef0123"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 3, sent: 2, removedSubscriptions: 1 });
    expect(runReminderCron).toHaveBeenCalledTimes(1);
  });
});
