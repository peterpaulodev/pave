import type { Metadata } from "next";
import { QuickEntryForm } from "./quick-entry-form";

export const metadata: Metadata = {
  title: "Novo gasto · Pave",
};

export default function NovoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Novo gasto</h1>
      <QuickEntryForm />
    </div>
  );
}
