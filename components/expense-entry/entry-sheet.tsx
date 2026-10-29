"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const CloseContext = createContext<(() => void) | null>(null);

/** Closes the surrounding bottom sheet; `null` when rendered full screen. */
export function useSheetClose() {
  return useContext(CloseContext);
}

const DISMISS_DISTANCE = 120;

/**
 * The entry screen as a bottom sheet over the dashboard (design.md D1),
 * mounted by the intercepted route. Closing — X, Esc, the backdrop, a drag
 * down on the handle, or the system back — leaves through `router.back()`.
 */
export function EntrySheet({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const close = () => setOpen(false);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && close()}
      // Wait for the exit animation before leaving the route.
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) router.back();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton
        className="h-[92dvh] gap-0 rounded-t-3xl p-0 data-[side=bottom]:h-[92dvh]"
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div
          aria-hidden="true"
          data-testid="sheet-handle"
          className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current !== null) setDragY(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            const dismissed = dragY > DISMISS_DISTANCE;
            dragStart.current = null;
            setDragY(0);
            if (dismissed) close();
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragY(0);
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <SheetTitle className="sr-only">Novo gasto</SheetTitle>
        <SheetDescription className="sr-only">Registre um gasto: valor, descrição, balde e data.</SheetDescription>
        <CloseContext.Provider value={close}>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </CloseContext.Provider>
      </SheetContent>
    </Sheet>
  );
}
