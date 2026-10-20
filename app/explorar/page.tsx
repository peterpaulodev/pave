import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explorar · Pave",
};

export default function ExplorarPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Explorar</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Página placeholder — conteúdo chega em uma próxima mudança.
      </p>
    </div>
  );
}
