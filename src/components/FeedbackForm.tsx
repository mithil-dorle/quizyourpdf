import { useState } from "react";
import { Loader2, MessageSquareHeart, Send, Star } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const KINDS = [
  { id: "feedback", label: "Feedback" },
  { id: "suggestion", label: "Suggestion" },
  { id: "feature", label: "Feature req" },
  { id: "bug", label: "Bug" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

const schema = z.object({
  kind: z.enum(["feedback", "suggestion", "feature", "bug"]),
  name: z
    .string()
    .trim()
    .max(100, { message: "That name is too long." })
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(3, { message: "Say a lil more (3+ characters)." })
    .max(2000, { message: "Keep it under 2000 characters." }),
  rating: z.number().int().min(1).max(5).nullable(),
  email: z
    .string()
    .trim()
    .max(255, { message: "That email is too long." })
    .email({ message: "That email doesn't look right." })
    .optional()
    .or(z.literal("")),
});

export function FeedbackForm({ className }: { className?: string }) {
  const [kind, setKind] = useState<Kind>("feedback");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = schema.safeParse({ kind, name, message, rating, email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }
    setStatus("sending");
    const { error: dbError } = await supabase.from("feedback").insert({
      kind: parsed.data.kind,
      name: parsed.data.name ? parsed.data.name : null,
      message: parsed.data.message,
      rating: parsed.data.rating,
      email: parsed.data.email ? parsed.data.email : null,
    });
    if (dbError) {
      setStatus("idle");
      setError("Couldn't send that — try again in a sec.");
      return;
    }
    setStatus("done");
    setName("");
    setMessage("");
    setRating(null);
    setEmail("");
  }

  return (
    <section
      className={cn("surface-card rounded-3xl border border-border p-5 sm:p-6", className)}
      aria-labelledby="feedback-heading"
    >
      <div className="flex items-center gap-2">
        <MessageSquareHeart className="size-5 text-primary" />
        <h2 id="feedback-heading" className="font-display text-lg font-bold">
          Got thoughts? Drop them
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Rate the vibes, request a feature, or tell us what broke.
      </p>

      {status === "done" ? (
        <p className="mt-4 rounded-2xl border border-border bg-secondary/40 px-4 py-5 text-center text-sm font-medium text-success">
          Sent — thank you, legend. 💚
          <button
            type="button"
            className="mt-2 block w-full text-xs font-medium text-muted-foreground underline"
            onClick={() => setStatus("idle")}
          >
            Send another
          </button>
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={cn(
                  "rounded-xl border px-2 py-2 text-xs font-bold transition-colors",
                  kind === k.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rating</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Rate ${n} out of 5`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      "size-6 transition-colors",
                      rating !== null && n <= rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <Textarea
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What should we build, fix, or hype up?"
            aria-label="Your feedback"
            className="min-h-24 rounded-2xl"
          />

          <Input
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            aria-label="Your name (optional)"
            className="rounded-2xl"
          />

          <Input
            value={email}
            maxLength={255}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional, if you want a reply)"
            aria-label="Email address (optional)"
            type="email"
            className="rounded-2xl"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="h-12 w-full rounded-2xl font-bold"
            onClick={submit}
            disabled={status === "sending"}
          >
            {status === "sending" ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 size-5" /> Send it
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
