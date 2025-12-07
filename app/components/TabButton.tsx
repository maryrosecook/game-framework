type TabButtonProps = {
  label: string;
  isActive: boolean;
  onSelect: () => void;
};

export function TabButton({ label, isActive, onSelect }: TabButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition cursor-pointer ${
        isActive
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
