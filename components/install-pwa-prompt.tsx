"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Chrome/Android only — no standard equivalent exists for iOS Safari
// (which requires the user to use Share → Add to Home Screen manually).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * Suggests installing the PWA right after onboarding, per
 * specs/onboarding/spec.md's "Incentivo à instalação do PWA": dismissible
 * ("Agora não"), and never blocks reaching the dashboard — the user is
 * already there by the time this can show, triggered by the one-time
 * `?onboarded=1` marker actions/onboarding.ts redirects with.
 *
 * Renders nothing unless the browser actually fired `beforeinstallprompt`
 * (requires HTTPS + a passing installability check — e.g. a registered
 * service worker in some Chrome versions, not set up yet; see tasks.md
 * section 9/Serwist). Showing nothing when the browser doesn't offer
 * installation matches the spec's own "em um navegador mobile que permite
 * instalação" condition.
 */
export function InstallPwaPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
  }, []);

  function clearOnboardedParam() {
    const params = new URLSearchParams(searchParams);
    params.delete("onboarded");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleDismiss() {
    setDismissed(true);
    clearOnboardedParam();
  }

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    setDismissed(true);
    clearOnboardedParam();
  }

  const visible =
    searchParams.get("onboarded") === "1" && installEvent !== null && !dismissed;

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.75rem)] z-20 flex justify-center px-4 lg:bottom-4 lg:left-[calc(5rem+0.75rem)] lg:justify-start lg:px-0">
      <Card className="pointer-events-auto w-full max-w-sm">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <p className="text-sm">Adicionar o Pave à tela inicial?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={handleDismiss}
            >
              Agora não
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              onClick={handleInstall}
            >
              Instalar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
