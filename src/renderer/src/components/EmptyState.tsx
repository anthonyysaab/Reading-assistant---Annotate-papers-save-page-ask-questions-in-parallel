export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      {hint ? <p className="max-w-xs text-xs leading-relaxed text-text-weak">{hint}</p> : null}
    </div>
  );
}
