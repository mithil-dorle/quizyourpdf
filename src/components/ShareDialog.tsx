import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  Send,
  Instagram,
  Twitter,
  Facebook,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

type ShareDialogProps = {
  url: string;
  title: string;
  text?: string;
  /** Optional label on the trigger button */
  label?: string;
};

const SHARE_TEXT = "turn your notes into a quiz game fr 📄⚡ try QuizLab:";

export function ShareDialog({ url, title, text, label }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareText = text ?? SHARE_TEXT;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API blocked — fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast.success("link copied — go spread the word 🔗");
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch {
      // user cancelled — no-op
    }
  };

  const shareInstagram = async () => {
    // Instagram has no web share URL — use native share sheet on mobile,
    // otherwise copy the link so it can be pasted into a story or DM.
    if (typeof navigator.share === "function") {
      await nativeShare();
      return;
    }
    await copyLink();
    toast.success("link copied — paste it in your insta story or dms 📸");
  };

  const options = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      className: "bg-[oklch(0.72_0.19_155/15%)] text-[oklch(0.82_0.19_155)]",
      onClick: () =>
        window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, "_blank"),
    },
    {
      name: "Telegram",
      icon: Send,
      className: "bg-[oklch(0.7_0.15_230/15%)] text-[oklch(0.8_0.15_230)]",
      onClick: () =>
        window.open(
          `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
          "_blank",
        ),
    },
    {
      name: "Instagram",
      icon: Instagram,
      className: "bg-accent/15 text-accent",
      onClick: shareInstagram,
    },
    {
      name: "X / Twitter",
      icon: Twitter,
      className: "bg-muted text-foreground",
      onClick: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
          "_blank",
        ),
    },
    {
      name: "Facebook",
      icon: Facebook,
      className: "bg-[oklch(0.65_0.17_255/15%)] text-[oklch(0.78_0.17_255)]",
      onClick: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          "_blank",
        ),
    },
    {
      name: "Email",
      icon: Mail,
      className: "bg-warning/15 text-warning",
      onClick: () =>
        window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%20${encodedUrl}`),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          aria-label="Share this page"
        >
          <Share2 className="size-4" />
          {label ?? "share"}
        </Button>
      </DialogTrigger>
      <DialogContent className="surface-card w-[calc(100vw-1.5rem)] max-w-sm border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">pass it on 🚀</DialogTitle>
          <DialogDescription>
            send this page to your study group, group chat, or that one friend
            who never studies.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2.5">
          {options.map((opt) => (
            <button
              key={opt.name}
              onClick={opt.onClick}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-2 py-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span
                className={`grid size-10 place-items-center rounded-full transition-transform group-hover:scale-110 ${opt.className}`}
              >
                <opt.icon className="size-5" />
              </span>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                {opt.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={copyLink}
          className="mt-1 flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-2 pl-3 text-left transition-colors hover:border-primary/40"
        >
          <span className="flex-1 truncate text-sm text-muted-foreground">{url}</span>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors ${
              copied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </span>
        </button>

        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <Button onClick={nativeShare} className="w-full rounded-full font-semibold">
            <Share2 className="size-4" />
            more options
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
