"use client";

import { BUCKET_LABELS, BUCKET_ORDER, type Bucket } from "@/lib/domain/buckets";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** The 3-bucket toggle shared by the quick-entry and recurring forms. */
export function BucketToggle({
  value,
  onChange,
}: {
  value: Bucket;
  onChange: (bucket: Bucket) => void;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values) => {
        const next = values[0];
        if (!next) return; // ignore deselect-to-empty
        onChange(next as Bucket);
      }}
      className="w-full"
    >
      {BUCKET_ORDER.map((key) => (
        <ToggleGroupItem key={key} value={key} className="min-h-11 flex-1">
          {BUCKET_LABELS[key]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
