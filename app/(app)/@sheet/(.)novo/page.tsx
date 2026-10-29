import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getEntryContext } from "@/server/entry-context";
import { EntrySheet } from "@/components/expense-entry/entry-sheet";
import { ExpenseEntry } from "@/components/expense-entry/expense-entry";

// Soft navigation to /novo from the dashboard lands here (refactor-expense-entry
// D1): the same screen as app/(app)/novo, as a sheet over the dashboard.
export default async function NovoSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string | string[] }>;
}) {
  const { src } = await searchParams;
  const { id: userId } = await getSessionUserOrRedirect();
  const context = await getEntryContext(userId);

  return (
    <EntrySheet>
      <ExpenseEntry
        context={context}
        source={src === "notification" ? "notification" : "quick_entry"}
      />
    </EntrySheet>
  );
}
