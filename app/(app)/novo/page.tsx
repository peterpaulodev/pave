import type { Metadata } from "next";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getEntryContext } from "@/server/entry-context";
import { ExpenseEntry } from "@/components/expense-entry/expense-entry";

export const metadata: Metadata = {
  title: "Novo gasto · Pave",
};

export default async function NovoPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string | string[] }>;
}) {
  // Only an exact "notification" counts; anything else is a plain quick entry.
  const { src } = await searchParams;
  const { id: userId } = await getSessionUserOrRedirect();
  const context = await getEntryContext(userId);

  return (
    <ExpenseEntry
      context={context}
      source={src === "notification" ? "notification" : "quick_entry"}
    />
  );
}
