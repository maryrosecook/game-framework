import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";

export type ColorSelectOption = {
  value: string;
  label: string;
  swatch: string;
};

type ColorSelectProps = {
  label: string;
  value: string;
  options: ColorSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ColorSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: ColorSelectProps) {
  const selected =
    options.find((option) => option.value === value) ??
    (value
      ? { value, label: value, swatch: value }
      : { value: "", label: "Select color", swatch: "transparent" });

  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
      {label}
      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-sm text-slate-900 outline-none focus:border-slate-400"
          aria-label={label}
        >
          <span className="flex-1">
            <span
              className="block h-6 w-full rounded-md border border-slate-200"
              style={{ backgroundColor: selected.swatch }}
              aria-hidden
            />
            <span className="sr-only">{selected.label}</span>
          </span>
          <Select.Icon asChild>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            collisionPadding={8}
            className="z-50 w-[220px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            style={{ maxHeight: "var(--radix-select-content-available-height)" }}
          >
            <Select.ScrollUpButton className="flex items-center justify-center py-1 text-slate-500">
              <ChevronUp className="h-4 w-4" />
            </Select.ScrollUpButton>

            <Select.Viewport
              className="max-h-[60vh] overflow-y-auto p-2"
              style={{ maxHeight: "var(--radix-select-content-available-height)" }}
            >
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="group flex w-full cursor-pointer items-center rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 data-[state=checked]:ring-2 data-[state=checked]:ring-slate-500"
                >
                  <span
                    aria-hidden
                    className="h-6 w-full rounded-md border border-slate-200"
                    style={{ backgroundColor: option.swatch }}
                  />
                  <Select.ItemText>
                    <span className="sr-only">{option.label}</span>
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>

            <Select.ScrollDownButton className="flex items-center justify-center py-1 text-slate-500">
              <ChevronDown className="h-4 w-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
  );
}
