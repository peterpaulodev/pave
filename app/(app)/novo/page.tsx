import type { Metadata } from "next";
import { QuickEntryForm } from "./quick-entry-form";

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
  const source = src === "notification" ? "notification" : "quick_entry";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Novo gasto</h1>
      <QuickEntryForm source={source} />
    </div>
  );
}
