import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The amount in cents, large and tabular. A live region, but a quiet one:
 * "polite" announces the final value after typing pauses.
 */
export function AmountDisplay({ cents }: { cents: number }) {
  const full = formatBRL(cents);
  const digits = full.replace(/^R\$\s?/, "");
  const empty = cents === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Valor ${full}`}
      data-testid="amount"
      className={cn(
        "flex items-baseline justify-center gap-2 font-semibold tracking-tight tabular-nums transition-colors",
        // 9 digits plus separators must still fit a 390px screen.
        digits.length <= 7 ? "text-6xl" : digits.length <= 10 ? "text-5xl" : "text-4xl",
        empty ? "text-muted-foreground" : "text-foreground"
      )}
    >
      <span aria-hidden="true" className="text-[0.4em] font-medium text-muted-foreground">
        R$
      </span>
      <span aria-hidden="true">{digits}</span>
    </div>
  );
}
