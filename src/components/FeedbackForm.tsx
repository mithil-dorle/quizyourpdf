import { useState } from "react";
import { Loader2, MessageSquareHeart, Send, Star, Lightbulb, MessageCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const KINDS = [
  { id: "feedback", label: "Feedback", icon: MessageCircle, vibe: "spill the tea" },
  { id: "suggestion", label: "Suggestion", icon: Lightbulb, vibe: "brainrot idea" },
  { id: "feature", label: "Feature", icon: Rocket, vibe: "make it slay" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

export function FeedbackForm({ className }: { className?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("feedback");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();

    if (!cleanName || cleanName.length > 100) return setError("Drop a name (under 100 chars).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 255)
      return setError("That email looks sus — try again.");
    if (!cleanMessage) return setError("Say something first 👀");
    if (cleanMessage.length > 1000) return setError("Keep it under 1000 characters.");

    setBusy(true);
    const { error: dbError } = await supabase.from("feedback").insert({
      name: cleanName,
      email: cleanEmail,
      kind,
      rating: rating || null,
      message: cleanMessage,
    });
    setBusy(false);

    if (dbError) {
      setError("Couldn't send that. Try again in a sec.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <section className={cn("surface-card glow-lime rounded-2xl p-5 text-center", className)}>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15">
          <MessageSquareHeart className="size-6 text-primary" />
        </div>
        <h2 className="mt-3 font-display text-lg font-bold">sent it 🫡</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Thanks {name.trim() || "legend"} — your {kind === "feature" ? "feature request" : kind} is
          in our inbox.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("surface-card rounded-2xl p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold leading-tight">
            spill the <span className="text-hype">tea</span> ☕
          </h2>
          <p className="text-xs text-muted-foreground">
            Feedback, ideas or just hype — we read everything.
          </p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15">
          <MessageSquareHeart className="size-5 text-primary" />
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="fb-name" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              who u?
            </label>
            <input
              id="fb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="your @"
              className="h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-sm outline-none transition-colors focus:border-primary focus:bg-secondary/60"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="fb-email" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              where we reply
            </label>
            <input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="you@mail.com"
              className="h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-sm outline-none transition-colors focus:border-primary focus:bg-secondary/60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            what&apos;s the vibe?
          </span>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "group relative flex flex-col items-center gap-1 rounded-xl border border-border px-2 py-2.5 text-[11px] font-bold transition-all",
                    kind === k.id
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_20px_-6px_var(--color-primary)]"
                      : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/70",
                  )}
                >
                  <Icon className={cn("size-4 transition-transform", kind === k.id && "scale-110")} />
                  <span>{k.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              rate the vibe
            </span>
            <span className="text-xs font-bold text-primary">
              {rating > 0 ? `${rating}/5` : "—"}
            </span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} out of 5`}
                onClick={() => setRating(n === rating ? 0 : n)}
                className="group rounded-lg p-1 transition-colors hover:bg-secondary/60"
              >
                <Star
                  className={cn(
                    "size-6 transition-all duration-200",
                    n <= rating
                      ? "fill-primary text-primary scale-110"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="fb-message" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            what&apos;s good / what&apos;s not
          </label>
          <textarea
            id="fb-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="be real with us…"
            className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:bg-secondary/60 resize-y"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-xl text-sm font-bold transition-transform active:scale-[0.98]"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" /> Send it
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
