"use client";

import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function ModeToggleButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 ${active ? "border-slate-400 bg-slate-100 shadow-sm" : ""}`}
    >
      {icon}
    </Button>
  );
}
