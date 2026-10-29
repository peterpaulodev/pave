import { redirect } from "next/navigation";
import { AppHeader } from "@/components/shell/AppHeader";
import { BottomNav } from "@/components/shell/BottomNav";
import { InstallPwaPrompt } from "@/components/install-pwa-prompt";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getUserSettings } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({
  children,
  sheet,
}: {
  children: React.ReactNode;
  // Parallel route: /novo opens here as a bottom sheet (app/(app)/@sheet).
  sheet: React.ReactNode;
}) {
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);

  // Inverse of the guard in app/onboarding/page.tsx: every page under this
  // group requires onboarding to be done first.
  if (!settings?.onboardedAt) {
    redirect("/onboarding");
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-20">
        <div className="mx-auto flex w-full max-w-screen-md flex-col px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav />
      {sheet}
      <InstallPwaPrompt />
    </>
  );
}
