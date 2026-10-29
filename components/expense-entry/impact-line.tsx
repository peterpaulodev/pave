import { previewImpact, type EntryImpactContext, type EntryImpactDraft } from "@/lib/domain/entry-impact";
import { cn } from "@/lib/utils";

/** Live effect of the draft on the budget (design.md D5); no server calls. */
export function ImpactLine({
  context,
  draft,
}: {
  context: EntryImpactContext;
  draft: EntryImpactDraft;
}) {
  const { text, over } = previewImpact(context, draft);
  return (
    <p
      data-testid="impact"
      className={cn(
        "text-center text-sm tabular-nums",
        // Neutral tone, never alarm red: over the plan is information, not an error.
        over ? "font-medium text-foreground" : "text-muted-foreground"
      )}
    >
      {text}
    </p>
  );
}
