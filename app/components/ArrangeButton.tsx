import { ReactNode } from "react";

type ArrangeButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function ArrangeButton({
  label,
  icon,
  onClick,
  disabled = false,
  fullWidth = true,
  className,
  ariaLabel,
}: ArrangeButtonProps) {
  const widthClass = fullWidth ? "w-full" : "w-auto";
  return (
    <button
      type="button"
      className={`flex ${widthClass} items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 ${
        className ?? ""
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? `Move to ${label.toLowerCase()}`}
    >
      <span className="flex items-center justify-center text-base leading-none">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
