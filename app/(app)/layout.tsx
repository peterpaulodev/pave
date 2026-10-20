import { AppHeader } from "@/components/shell/AppHeader";
import { BottomNav } from "@/components/shell/BottomNav";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-20">
        <div className="mx-auto flex w-full max-w-screen-md flex-col px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
