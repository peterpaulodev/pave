"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { createExpense, deleteExpense } from "@/actions/expenses";
import type { Bucket } from "@/lib/domain/buckets";
import { keypad, type KeypadKey } from "@/lib/domain/amount-keypad";
import type { EntryChip } from "@/lib/domain/entry-chips";
import { isYesterdayAllowed, previousDay } from "@/lib/domain/entry-date";
import { parseQuickEntry } from "@/lib/domain/parse-quick-entry";
import { suggestBucket } from "@/lib/domain/suggest-bucket";
import { formatBRL } from "@/lib/money";
import type { EntryContext } from "@/server/entry-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AmountDisplay } from "./amount-display";
import { AmountKeypad } from "./amount-keypad";
import { BucketSelector, type BucketMark } from "./bucket-selector";
import { DateChips, type DateChoice } from "./date-chips";
import { DescriptionChips } from "./description-chips";
import { ImpactLine } from "./impact-line";
import { useSheetClose } from "./entry-sheet";

const SUCCESS_MS = 600;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Saved {
  id: string;
  description: string;
  cents: number;
}

/**
 * The expense entry screen (refactor-expense-entry): amount first, then the
 * description chip, bucket, date, and a live effect line. Rendered inside the
 * bottom sheet (`useSheetClose()` is set) or full screen at `/novo`.
 */
export function ExpenseEntry({
  context,
  source = "quick_entry",
}: {
  context: EntryContext;
  source?: "quick_entry" | "notification";
}) {
  const router = useRouter();
  const closeSheet = useSheetClose();
  const inSheet = closeSheet !== null;

  const [cents, setCents] = useState(0);
  const [chip, setChip] = useState<EntryChip | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [otherFocused, setOtherFocused] = useState(false);
  const [manualBucket, setManualBucket] = useState<Bucket | null>(null);
  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [otherDate, setOtherDate] = useState(context.today);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [pending, startTransition] = useTransition();

  const openedAt = useRef(0);
  const otherInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // ── derived draft ────────────────────────────────────────────────────────
  const description = otherOpen ? otherText.trim() : (chip?.label ?? "");
  const date =
    dateChoice === "today" ? context.today : dateChoice === "yesterday" ? previousDay(context.today) : otherDate;

  let bucket: Bucket = "needs";
  let mark: BucketMark = null;
  if (manualBucket) {
    bucket = manualBucket;
  } else if (!otherOpen && chip) {
    bucket = chip.bucket;
    mark = chip.source === "history" ? "history" : "suggested";
  } else if (otherOpen && suggestBucket(otherText)) {
    bucket = suggestBucket(otherText)!;
    mark = "suggested";
  }

  const missing =
    cents === 0 && !description
      ? "Digite o valor e escolha uma descrição"
      : cents === 0
        ? "Digite o valor"
        : !description
          ? "Escolha uma descrição"
          : null;
  const busy = pending || celebrating;

  // ── actions ──────────────────────────────────────────────────────────────
  function press(key: KeypadKey) {
    if (busy || saved) return;
    if (!prefersReducedMotion()) navigator.vibrate?.(8);
    setCents((current) => keypad(current, key));
    setError(null);
  }

  function chooseChip(next: EntryChip) {
    setError(null);
    setManualBucket(null);
    setOtherOpen(false);
    setOtherFocused(false);
    setChip(chip?.label === next.label ? null : next); // tap again to unselect
  }

  function toggleOther() {
    setError(null);
    if (otherOpen) {
      settleOther();
      setOtherOpen(false);
      return;
    }
    setChip(null);
    setManualBucket(null);
    setOtherOpen(true);
    setOtherFocused(true);
  }

  /** "padaria 12,50" typed with the amount still at zero: the amount goes to the keypad. */
  function settleOther() {
    const parsed = parseQuickEntry(otherText);
    if (cents === 0 && parsed) {
      setCents(parsed.amountCents);
      setOtherText(parsed.description);
    }
    setOtherFocused(false);
  }

  function submit() {
    if (missing || busy) return;
    setError(null);
    const usedChip = !otherOpen && chip !== null;

    startTransition(async () => {
      const result = await createExpense({
        amountCents: cents,
        description,
        bucket,
        source,
        occurredOn: date,
        usedChip,
        chipSource: usedChip ? chip!.source : null,
        durationMs: Date.now() - openedAt.current,
      });
      if (!result.data) {
        setError(result.error ?? "Não foi possível salvar o gasto");
        return; // the draft stays as it was
      }

      const info = { id: result.data.id, description, cents };
      setSaved(info);
      if (closeSheet) {
        setCelebrating(true);
        await new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : SUCCESS_MS));
        toast.success(`${info.description} · ${formatBRL(info.cents)} salvo`, {
          action: { label: "Desfazer", onClick: () => void undo(info.id, false) },
        });
        closeSheet(); // the action already revalidated the dashboard
      }
    });
  }

  async function undo(id: string, backToDraft: boolean) {
    await deleteExpense(id);
    if (backToDraft) setSaved(null);
    router.refresh();
  }

  function another() {
    // Amount and description are cleared; the chosen date stays.
    setCents(0);
    setChip(null);
    setOtherOpen(false);
    setOtherText("");
    setManualBucket(null);
    setSaved(null);
  }

  // Physical keyboard: digits, Backspace and Enter work like the keypad.
  const latest = useRef({ press, submit });
  useEffect(() => {
    latest.current = { press, submit };
  });
  useEffect(() => {
    let tabbed = false;
    const onPointerDown = () => (tabbed = false);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") tabbed = true;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        latest.current.press(Number(event.key) as KeypadKey);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        latest.current.press("backspace");
      } else if (event.key === "Enter" && !(tabbed && target instanceof HTMLButtonElement)) {
        // A button reached with Tab keeps its own Enter; one merely tapped
        // or clicked (a chip) doesn't, so Enter still saves.
        event.preventDefault();
        latest.current.submit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // ── full-screen confirmation ─────────────────────────────────────────────
  if (saved && !inSheet) {
    return (
      <div role="status" className="flex flex-col items-center gap-6 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-bucket-savings/12 text-bucket-savings motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
          <Check className="size-8" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold tabular-nums">
          {saved.description} · {formatBRL(saved.cents)} salvo
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button className="min-h-12 w-full text-base" onClick={another}>
            Lançar outro
          </Button>
          <Button variant="outline" className="min-h-12 w-full text-base" onClick={() => router.push("/")}>
            Ir para o painel
          </Button>
          <Button variant="ghost" className="min-h-11 w-full" onClick={() => void undo(saved.id, true)}>
            Desfazer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-col", inSheet ? "min-h-0 flex-1" : "gap-5")}>
      {!inSheet && <h1 className="text-xl font-semibold">Novo gasto</h1>}

      <div className={cn("flex flex-col gap-5", inSheet && "min-h-0 flex-1 overflow-y-auto px-4 pb-4")}>
        <div className="flex flex-col gap-1.5 pt-1">
          <AmountDisplay cents={cents} />
          <ImpactLine context={context} draft={{ amountCents: cents, bucket, date }} />
        </div>

        <DescriptionChips
          chips={context.chips}
          selected={otherOpen ? null : chip}
          otherOpen={otherOpen}
          onSelect={chooseChip}
          onOther={toggleOther}
        />

        {otherOpen && (
          <div className="flex gap-2">
            <Input
              ref={otherInput}
              autoFocus
              value={otherText}
              placeholder="Descrição, ex.: padaria"
              aria-label="Descrição do gasto"
              className="min-h-11 text-base"
              onChange={(event) => setOtherText(event.target.value)}
              onFocus={() => setOtherFocused(true)}
              onBlur={settleOther}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  otherInput.current?.blur();
                }
              }}
            />
            {otherFocused && (
              <Button type="button" variant="secondary" className="min-h-11 px-4" onMouseDown={(e) => e.preventDefault()} onClick={() => otherInput.current?.blur()}>
                OK
              </Button>
            )}
          </div>
        )}

        <BucketSelector value={bucket} mark={mark} onChange={setManualBucket} />

        <DateChips
          choice={dateChoice}
          otherDate={otherDate}
          range={context.dateRange}
          yesterdayAllowed={isYesterdayAllowed(context.today)}
          onChoose={setDateChoice}
          onPick={(picked) => {
            setOtherDate(picked);
            setDateChoice("other");
          }}
        />

        <AmountKeypad onKey={press} className={cn(otherFocused && "hidden")} />
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 bg-background pt-3",
          inSheet
            ? "border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] pb-3 lg:bottom-0"
        )}
      >
        {error ? (
          <p role="alert" className="text-center text-sm font-medium text-destructive">
            {error}
          </p>
        ) : (
          missing && (
            <p id="save-hint" className="text-center text-sm text-muted-foreground">
              {missing}
            </p>
          )
        )}
        <Button
          type="button"
          className="min-h-14 w-full text-base font-semibold tabular-nums"
          disabled={Boolean(missing) || busy}
          aria-describedby={missing ? "save-hint" : undefined}
          onClick={submit}
        >
          {busy ? "Salvando…" : `Salvar ${formatBRL(cents)}`}
        </Button>
      </div>

      {celebrating && (
        <div
          role="status"
          aria-label="Gasto salvo"
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/90"
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-bucket-savings/12 text-bucket-savings motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
            <Check className="size-10" aria-hidden="true" />
          </span>
        </div>
      )}
    </div>
  );
}
