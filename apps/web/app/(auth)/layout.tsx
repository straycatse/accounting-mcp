import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="w-full max-w-sm">{children}</div>
      <footer className="text-xs text-muted-foreground">
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>{" "}
        · Stray Cat AB
      </footer>
    </div>
  );
}
