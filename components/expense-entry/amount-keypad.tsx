"use client";

import { useRef } from "react";
import { Delete } from "lucide-react";
import type { KeypadKey } from "@/lib/domain/amount-keypad";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 500;

const KEY_CLASS =
  "flex h-14 items-center justify-center rounded-2xl bg-muted text-2xl font-medium tabular-nums " +
  "transition-[background-color,transform] duration-100 select-none touch-manipulation " +
  "hover:bg-foreground/10 active:scale-[0.96] active:bg-foreground/15 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** 3×4 amount keypad (refactor-expense-entry D2); keys are 56px tall. */
export function AmountKeypad({
  onKey,
  className,
}: {
  onKey: (key: KeypadKey) => void;
  className?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleared = useRef(false);

  function startHold() {
    cleared.current = false;
    timer.current = setTimeout(() => {
      cleared.current = true;
      onKey("clear");
    }, LONG_PRESS_MS);
  }
  function endHold(commit: boolean) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // A release before the long press is a plain "apagar".
    if (commit && !cleared.current) onKey("backspace");
  }

  const keys: { key: KeypadKey; label: string; aria: string }[] = [
    ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({ key: n, label: String(n), aria: String(n) })),
    { key: "00", label: "00", aria: "Dois zeros" },
    { key: 0, label: "0", aria: "0" },
  ];

  return (
    <div role="group" aria-label="Teclado numérico" className={cn("grid grid-cols-3 gap-2", className)}>
      {keys.map(({ key, label, aria }) => (
        <button
          key={label}
          type="button"
          aria-label={aria}
          className={KEY_CLASS}
          onClick={() => onKey(key)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        aria-label="Apagar (segure para limpar tudo)"
        className={KEY_CLASS}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          startHold();
        }}
        onPointerUp={() => endHold(true)}
        onPointerLeave={() => endHold(false)}
        onPointerCancel={() => endHold(false)}
        onContextMenu={(event) => event.preventDefault()}
        // Keyboard activation (Enter/Space) has no pointer events: detail is 0.
        onClick={(event) => {
          if (event.detail === 0) onKey("backspace");
        }}
      >
        <Delete className="size-6" aria-hidden="true" />
      </button>
    </div>
  );
}
