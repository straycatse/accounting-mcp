import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "accounting-mcp",
  description: "Connect your accounting software to AI assistants via MCP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <p className="muted" style={{ marginTop: "3rem" }}>
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · Stray Cat AB
        </p>
      </body>
    </html>
  );
}
