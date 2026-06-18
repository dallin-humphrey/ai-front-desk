export default function Loading() {
  return (
    <div className="flex flex-col w-full max-w-[480px] mx-auto min-h-dvh items-center justify-center text-[var(--muted)]">
      <div className="flex items-center gap-1.5">
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-[var(--muted)]" />
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-[var(--muted)]" />
        <span className="typing-dot inline-block w-2 h-2 rounded-full bg-[var(--muted)]" />
      </div>
    </div>
  );
}
