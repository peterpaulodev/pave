import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getUserSettings } from "@/server/queries";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bem-vindo · Pave",
};

export default async function OnboardingPage() {
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);

  // Inverse of the guard in app/(app)/layout.tsx: a user who already
  // finished onboarding should never see this screen again.
  if (settings?.onboardedAt) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <OnboardingForm />
    </div>
  );
}
