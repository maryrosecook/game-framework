import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";

type ColorSelectProps = {
  label: string;
  value: string;
  options: string[];
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
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
      {label}
      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          className="inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          aria-label={label}
        >
          <span
            className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200"
            style={{ backgroundColor: value }}
          >
            <span className="sr-only">{value}</span>
          </span>
          <Select.Icon asChild>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <Select.ScrollUpButton className="flex items-center justify-center py-1 text-slate-500">
              <ChevronUp className="h-4 w-4" />
            </Select.ScrollUpButton>

            <Select.Viewport className="grid min-w-[188px] grid-cols-6 gap-2 p-2">
              {options.map((option) => (
                <Select.Item
                  key={option}
                  value={option}
                  className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 data-[state=checked]:ring-2 data-[state=checked]:ring-slate-500"
                >
                  <span
                    aria-hidden
                    className="block h-6 w-6 rounded-full"
                    style={{ backgroundColor: option }}
                  />
                  <Select.ItemText>
                    <span className="sr-only">{option}</span>
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
