"use client";

import { CopyButton } from "@/components/copy-button";

export function CopyField({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto rounded-md bg-muted px-2.5 py-2 font-mono text-xs whitespace-nowrap">
        {text}
      </code>
      <CopyButton text={text} />
    </div>
  );
}
