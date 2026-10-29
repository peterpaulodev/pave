"use client";

import { Check } from "lucide-react";
import type { EntryChip } from "@/lib/domain/entry-chips";
import { cn } from "@/lib/utils";

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium " +
  "transition-[background-color,transform] duration-100 touch-manipulation active:scale-[0.97] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Frequent descriptions plus "Outro" (design.md D3). One selected at a time. */
export function DescriptionChips({
  chips,
  selected,
  otherOpen,
  onSelect,
  onOther,
}: {
  chips: EntryChip[];
  selected: EntryChip | null;
  otherOpen: boolean;
  onSelect: (chip: EntryChip) => void;
  onOther: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Descrição do gasto"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const on = selected?.label === chip.label;
        return (
          <button
            key={chip.label}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(chip)}
            className={cn(
              CHIP_CLASS,
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {on && <Check className="size-4" aria-hidden="true" />}
            {chip.label}
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={otherOpen}
        onClick={onOther}
        className={cn(
          CHIP_CLASS,
          otherOpen
            ? "border-foreground bg-foreground text-background"
            : "border-dashed border-muted-foreground/60 bg-background hover:bg-muted"
        )}
      >
        + Outro
      </button>
    </div>
  );
}
