type ArrangeButtonProps = {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
};

export function ArrangeButton({
  label,
  icon,
  onClick,
  disabled = false,
}: ArrangeButtonProps) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Move to ${label.toLowerCase()}`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
