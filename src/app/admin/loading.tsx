export default function AdminLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center text-[var(--muted)]">
      <div className="flex items-center gap-1.5">
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-[var(--muted)]" />
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-[var(--muted)]" />
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-[var(--muted)]" />
      </div>
    </div>
  );
}
