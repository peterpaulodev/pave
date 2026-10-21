import type { Metadata } from "next";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getUserSettings } from "@/server/queries";
import { ReminderSettings } from "./reminder-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configurações · Pave",
};

export default async function ConfiguracoesPage() {
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <ReminderSettings
        enabled={settings?.reminderEnabled ?? false}
        hour={settings?.reminderHour ?? 20}
      />
    </div>
  );
}
