import { useState } from "react";
import { Loader2, MessageSquareHeart, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const KINDS = [
  { id: "feedback", label: "Feedback" },
  { id: "suggestion", label: "Suggestion" },
  { id: "feature", label: "Feature request" },
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
      <section className={cn("surface-card rounded-3xl p-6 text-center sm:p-8", className)}>
        <MessageSquareHeart className="mx-auto size-8 text-primary" />
        <h2 className="mt-3 font-display text-xl font-bold">sent it 🫡</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks {name.trim() || "legend"} — your {kind === "feature" ? "feature request" : kind} is
          in our inbox.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("surface-card rounded-3xl p-5 sm:p-8", className)}>
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          got <span className="text-hype">thoughts?</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Feedback, suggestions or a feature you want — drop it here.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="fb-name" className="text-xs font-semibold text-muted-foreground">
              Name
            </label>
            <input
              id="fb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="your name"
              className="h-12 w-full rounded-2xl border border-border bg-secondary/40 px-4 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fb-email" className="text-xs font-semibold text-muted-foreground">
              Email
            </label>
            <input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="you@mail.com"
              className="h-12 w-full rounded-2xl border border-border bg-secondary/40 px-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Type</span>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn(
                  "h-11 rounded-2xl border border-border text-xs font-bold transition-colors",
                  kind === k.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-secondary/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Rating</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} out of 5`}
                onClick={() => setRating(n === rating ? 0 : n)}
                className="p-1"
              >
                <Star
                  className={cn(
                    "size-7",
                    n <= rating ? "fill-primary text-primary" : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fb-message" className="text-xs font-semibold text-muted-foreground">
            Message
          </label>
          <textarea
            id="fb-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="tell us what's good and what's not…"
            className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="h-13 w-full rounded-2xl py-3 text-base font-bold"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 size-5" /> Send it
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
