type ToastProps = {
  message: string | null;
};

export function Toast({ message }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-800 shadow-lg"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
