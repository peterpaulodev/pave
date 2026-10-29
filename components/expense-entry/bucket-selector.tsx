"use client";

import { BUCKET_LABELS, BUCKET_ORDER, type Bucket } from "@/lib/domain/buckets";
import { BUCKET_META } from "@/components/bucket-meta";
import { cn } from "@/lib/utils";

export type BucketMark = "history" | "suggested" | null;

const MARK_TEXT: Record<Exclude<BucketMark, null>, string> = {
  history: "como da última vez",
  suggested: "sugerido",
};

/** Three-way bucket picker with color and icon (design.md D4). */
export function BucketSelector({
  value,
  mark,
  onChange,
}: {
  value: Bucket;
  mark: BucketMark;
  onChange: (bucket: Bucket) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Balde" className="grid grid-cols-3 gap-2">
      {BUCKET_ORDER.map((bucket) => {
        const meta = BUCKET_META[bucket];
        const Icon = meta.icon;
        const on = bucket === value;
        return (
          <button
            key={bucket}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(bucket)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-2 touch-manipulation",
              "transition-[background-color,border-color,transform] duration-100 active:scale-[0.97]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              on
                ? cn(meta.outline, meta.tint, meta.text)
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="text-sm font-semibold">{BUCKET_LABELS[bucket]}</span>
            {on && mark && <span className="text-[0.6875rem] leading-tight whitespace-nowrap">{MARK_TEXT[mark]}</span>}
          </button>
        );
      })}
    </div>
  );
}
