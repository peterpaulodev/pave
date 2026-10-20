"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Chrome/Android only — iOS Safari never fires this; it gets the manual
// "Compartilhar → Adicionar à Tela de Início" instructions below instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own non-standard flag — there's no `display-mode`
    // media query support there.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  // Other iOS browsers (Chrome, Firefox, Edge) use Safari's WebKit under
  // the hood and match /Safari/ too, but add their own token to the UA.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

/**
 * Suggests installing the PWA right after onboarding, per
 * specs/onboarding/spec.md's "Incentivo à instalação do PWA": dismissible,
 * and never blocks reaching the dashboard — the user is already there by
 * the time this can show, triggered by the one-time `?onboarded=1` marker
 * actions/onboarding.ts redirects with.
 *
 * Two paths, both only shown when the app isn't already running in
 * standalone mode:
 * - Chrome/Android (and other browsers that fire `beforeinstallprompt`):
 *   a real "Instalar"/"Agora não" prompt.
 * - iOS Safari, which never fires that event: dismissible manual
 *   instructions ("Compartilhar → Adicionar à Tela de Início") instead.
 * Any other browser (no install prompt support and not iOS Safari) shows
 * nothing, matching the spec's "navegador mobile que permite instalação"
 * condition.
 */
export function InstallPwaPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Default to "standalone" / "not iOS Safari" until the effect below
  // checks for real, so there's never a flash of the banner during
  // server render or before hydration runs.
  const [standalone, setStandalone] = useState(true);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    // Deliberately not derived state: `isStandalone`/`isIosSafari` read
    // `window`/`navigator`, unavailable during SSR. Computing them inline
    // during render would make the client's first render disagree with
    // the server-rendered HTML (a hydration mismatch) whenever they're
    // true. Reading them only after mount, and defaulting to "hidden"
    // (`standalone: true`) until then, keeps the two renders in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(isStandalone());
    setIosSafari(isIosSafari());
  }, []);

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

  const justOnboarded = searchParams.get("onboarded") === "1";
  const canPromptInstall = installEvent !== null;
  const showIosInstructions = !canPromptInstall && iosSafari;

  const visible =
    justOnboarded &&
    !dismissed &&
    !standalone &&
    (canPromptInstall || showIosInstructions);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.75rem)] z-20 flex justify-center px-4 lg:bottom-4 lg:left-[calc(5rem+0.75rem)] lg:justify-start lg:px-0">
      <Card className="pointer-events-auto w-full max-w-sm">
        {canPromptInstall ? (
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
        ) : (
          <CardContent className="flex flex-col gap-2 py-3">
            <p className="text-sm">
              Para instalar: toque em <strong>Compartilhar</strong> e depois
              em <strong>Adicionar à Tela de Início</strong>.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 self-end"
              onClick={handleDismiss}
            >
              Entendi
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
