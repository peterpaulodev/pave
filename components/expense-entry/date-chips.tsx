"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateChoice = "today" | "yesterday" | "other";

const CHIP =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm touch-manipulation " +
  "transition-[background-color,transform] duration-100 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** "12/10" from "2026-10-12". */
const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Hoje / Ontem / Outra data (design.md D6). "Outra data" opens the browser's
 * own date picker through a hidden `<input type="date">` limited to the month.
 */
export function DateChips({
  choice,
  otherDate,
  range,
  yesterdayAllowed,
  onChoose,
  onPick,
}: {
  choice: DateChoice;
  otherDate: string;
  range: { min: string; max: string };
  yesterdayAllowed: boolean;
  onChoose: (choice: "today" | "yesterday") => void;
  onPick: (date: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const noOtherDay = range.min === range.max;

  function openPicker() {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const style = (on: boolean) =>
    cn(CHIP, on ? "border-foreground bg-foreground text-background font-medium" : "border-border bg-background hover:bg-muted text-foreground");

  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Data do gasto" className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={choice === "today"} className={style(choice === "today")} onClick={() => onChoose("today")}>
          Hoje
        </button>
        <button
          type="button"
          aria-pressed={choice === "yesterday"}
          disabled={!yesterdayAllowed}
          aria-describedby={yesterdayAllowed ? undefined : "yesterday-hint"}
          className={style(choice === "yesterday")}
          onClick={() => onChoose("yesterday")}
        >
          Ontem
        </button>
        <span className="relative">
          <button
            type="button"
            aria-pressed={choice === "other"}
            disabled={noOtherDay}
            className={style(choice === "other")}
            onClick={openPicker}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            {choice === "other" ? short(otherDate) : "Outra data"}
          </button>
          <input
            ref={input}
            type="date"
            aria-label="Outra data"
            tabIndex={-1}
            min={range.min}
            max={range.max}
            value={otherDate}
            onChange={(event) => {
              if (!event.target.value) return;
              onPick(event.target.value);
              // Hand the keyboard back to the amount (digits, Backspace, Enter).
              event.target.blur();
            }}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </span>
      </div>
      {!yesterdayAllowed && (
        <p id="yesterday-hint" className="text-xs text-muted-foreground">
          Ontem pertence ao mês anterior
        </p>
      )}
    </div>
  );
}
