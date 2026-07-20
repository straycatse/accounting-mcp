"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGate } from "@/components/auth-gate";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Route → message key; the label itself is looked up at render time so it
// follows the active locale.
const TITLE_KEYS = {
  "/dashboard": "dashboard",
  "/companies": "companies",
  "/connectors": "connectors",
} as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const titleKey = TITLE_KEYS[pathname as keyof typeof TITLE_KEYS];
  const title = titleKey ? t(titleKey) : "accounting-mcp";

  return (
    <AuthGate>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <h1 className="text-sm font-medium">{title}</h1>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGate>
  );
}
