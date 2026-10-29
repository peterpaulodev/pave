import { House, PiggyBank, Sparkles, type LucideIcon } from "lucide-react";
import type { Bucket } from "@/lib/domain/buckets";

/**
 * Icon and color classes per bucket (refactor-expense-entry D4). The colors
 * are the `--bucket-*` tokens in globals.css (with dark variants); the class
 * names are written out in full so Tailwind can see them.
 */
export const BUCKET_META: Record<
  Bucket,
  { icon: LucideIcon; text: string; tint: string; outline: string }
> = {
  needs: {
    icon: House,
    text: "text-bucket-needs",
    tint: "bg-bucket-needs/12",
    outline: "border-bucket-needs",
  },
  wants: {
    icon: Sparkles,
    text: "text-bucket-wants",
    tint: "bg-bucket-wants/12",
    outline: "border-bucket-wants",
  },
  savings: {
    icon: PiggyBank,
    text: "text-bucket-savings",
    tint: "bg-bucket-savings/12",
    outline: "border-bucket-savings",
  },
};
