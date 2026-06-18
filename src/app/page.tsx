"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

// Fallback used only if the API call fails. The live list comes from
// /api/prompts and is operator-editable in /admin.
const FALLBACK_SUGGESTED = [
  "Are you open on Veterans Day?",
  "What's tuition for infants?",
  "My child has a fever, can they come in?",
  "What time does drop-off end?",
  "What should I pack on my toddler's first day?",
];

const PHONE = "(801) 555-0142";

type AssistantMeta = {
  source?: { title: string; path: string };
  escalated?: boolean;
  escalationKind?:
    | "medical"
    | "custody"
    | "no_match"
    | "complaint"
    | "individual_child";
};

export default function ParentChat() {
  const [input, setInput] = useState("");
  const [suggested, setSuggested] = useState<string[]>(FALLBACK_SUGGESTED);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prompts")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.prompts?.length) return;
        setSuggested(j.prompts.map((p: { text: string }) => p.text));
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isWorking = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isWorking) return;
    setInput("");
    sendMessage({ text: trimmed });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <main className="flex flex-col w-full max-w-[480px] mx-auto min-h-dvh bg-[var(--surface)] shadow-sm">
      <header className="sticky top-0 z-10 px-5 pt-5 pb-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">
          Maple Grove Early Learning
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Front Desk</p>
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
      >
        {messages.length === 0 ? (
          <EmptyState onPick={send} suggested={suggested} />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}

        {status === "submitted" && <TypingIndicator />}

        {error && (
          <div className="rounded-2xl border border-[var(--danger)]/30 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
            <div className="font-medium">Hmm, that didn&apos;t go through.</div>
            <div className="mt-1">
              Try again, or call us at{" "}
              <a
                className="underline"
                href={`tel:${PHONE.replace(/[^0-9+]/g, "")}`}
              >
                {PHONE}
              </a>
              .
            </div>
            <button
              onClick={() => regenerate()}
              className="mt-2 inline-flex items-center text-xs font-medium text-[var(--danger)] underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 px-3 py-3 bg-[var(--surface)] border-t border-[var(--border)]"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask us anything…"
            rows={1}
            autoFocus
            className="flex-1 resize-none rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-[15px] leading-snug focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-transparent max-h-32"
          />
          <button
            type="submit"
            disabled={!input.trim() || isWorking}
            className={`shrink-0 rounded-full bg-[var(--primary)] text-white w-10 h-10 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
              status === "streaming" ? "animate-pulse-soft" : ""
            }`}
            aria-label="Send"
          >
            <ArrowUp />
          </button>
        </div>
      </form>
    </main>
  );
}

function EmptyState({
  onPick,
  suggested,
}: {
  onPick: (q: string) => void;
  suggested: string[];
}) {
  return (
    <div className="pt-8 pb-2 space-y-5">
      <div className="space-y-2">
        <h2 className="text-base font-medium text-[var(--foreground)]">
          Hi! How can we help?
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Ask about hours, tuition, our policies, scheduling a tour, or
          anything else. I answer from our family handbook, and when
          I&apos;m not sure, I&apos;ll connect you with someone here.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggested.map((q, i) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="animate-fade-in-up text-left text-sm rounded-full bg-[var(--surface-alt)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] transition-colors px-3.5 py-2 border border-[var(--border)]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary-soft)] text-[var(--foreground)] px-4 py-2.5 text-[15px] leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  const meta = parseAssistantMeta(text);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[var(--surface-alt)] text-[var(--foreground)] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
        {meta.displayText}
      </div>
      {meta.source && (
        <div className="text-xs text-[var(--muted)] pl-1">
          From: <span className="font-medium">{meta.source.path}</span>
        </div>
      )}
      {meta.escalated && (
        <EscalationCard
          kind={meta.escalationKind ?? "no_match"}
          hasSource={!!meta.source}
        />
      )}
    </div>
  );
}

function parseAssistantMeta(
  text: string,
): AssistantMeta & { displayText: string } {
  // Strip "Source: <path>" trailer and surface as provenance.
  const sourceMatch = text.match(/\bSource:\s*(.+?)\s*$/);
  let displayText = text;
  let source: AssistantMeta["source"];
  if (sourceMatch) {
    const path = sourceMatch[1].trim();
    const titleFromPath = path.split(">").pop()?.trim() ?? path;
    source = { title: titleFromPath, path };
    displayText = text.slice(0, sourceMatch.index).trimEnd();
  }

  const lower = displayText.toLowerCase();

  // An answer is "escalated" only when it genuinely refuses or routes,
  // not when it just closes with "feel free to call us." Match real
  // refusal signals: "I can't", "I don't have", "call 911", "let me have
  // someone", "I'm sorry... that experience", "connect you with",
  // "isn't in our handbook."
  const escalated =
    /i (?:can't|cannot) (?:tell|judge|help|decide|make)|can't make the call|i don't have that on file|call 911|please call 9-?1-?1|for (?:our )?staff to make|i'?m (?:so |really |genuinely )?sorry.*?(?:dealing|experience|with this|happened|hear|frustrat)|let me have someone|connect you with|isn't in (?:our|the) handbook|not in (?:our|the) handbook/.test(
      lower,
    );

  let escalationKind: AssistantMeta["escalationKind"] = undefined;
  if (escalated) {
    if (/911|emergency/.test(lower)) {
      escalationKind = "medical";
    } else if (
      /custody|pickup list|legal guardian|court order|restraining|parenting plan/.test(
        lower,
      )
    ) {
      escalationKind = "custody";
    } else if (
      /i'?m (?:so |really |genuinely )?sorry.*?(?:dealing|experience|with this|happened|hear|frustrat)|director(?!y)|work through (?:it|this)/.test(
        lower,
      )
    ) {
      escalationKind = "complaint";
    } else if (
      /fever|sick|medic|allerg|illness|symptom|the written|our (?:written )?policy|written (?:policy|threshold)|written threshold|stay home|fever-free|specific (?:child|son|daughter|kid)|your (?:specific )?(?:son|daughter|kid|baby|toddler|little one)|pediatrician|your child/.test(
        lower,
      )
    ) {
      escalationKind = "medical";
    } else if (
      /don't have that on file|isn't in (?:our|the) handbook|not in our handbook/.test(
        lower,
      )
    ) {
      escalationKind = "no_match";
    } else {
      escalationKind = "no_match";
    }
  }

  return { displayText, source, escalated, escalationKind };
}

function EscalationCard({
  kind,
  hasSource,
}: {
  kind: NonNullable<AssistantMeta["escalationKind"]>;
  hasSource: boolean;
}) {
  const copy = (() => {
    switch (kind) {
      case "medical":
        return hasSource
          ? "I can share our written policy, but I can't judge whether your child should come in. Please call us so we can think it through with you."
          : "Please call us so we can help figure out the right next step.";
      case "custody":
        return "Please call us so we can review your file together and get it right.";
      case "complaint":
        return "Please call our director so we can work through this with you directly.";
      case "individual_child":
        return "Your child's daily sheet has today's details, and the front desk can fill in anything else.";
      case "no_match":
      default:
        return "This isn't in our handbook yet. Let me have someone from our office reach out so you get the right answer.";
    }
  })();

  return (
    <div className="w-full max-w-[90%] rounded-xl border border-[var(--accent)]/60 bg-amber-50 px-4 py-3 mt-1">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 mt-0.5">
          <PhoneIcon />
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium text-stone-900">
            Let&apos;s get a person involved.
          </div>
          <p className="text-sm text-stone-700 leading-snug">{copy}</p>
          <a
            href={`tel:${PHONE.replace(/[^0-9+]/g, "")}`}
            className="inline-flex items-center text-sm font-medium text-[var(--primary)] hover:underline mt-0.5"
          >
            Call {PHONE} →
          </a>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-[var(--surface-alt)] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
          <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
          <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--accent)]"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
