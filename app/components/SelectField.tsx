export function SelectField<TValue extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: TValue;
  options: { label: string; value: TValue }[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
      {label}
      <select
        className="select-chevron w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400 cursor-pointer"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const selected = options.find(
            (option) => option.value === event.target.value
          );
          if (!selected) return;
          onChange(selected.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
