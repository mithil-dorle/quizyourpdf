import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
  variant?: "lime" | "pink" | "ghost";
}

export function ShareButton({ title, text, url, className, variant = "lime" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "https://quizyourpdf.com");

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url: shareUrl });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const variantClasses = {
    lime: "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60",
    pink: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent/60",
    ghost: "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary",
  };

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all active:scale-95",
        variantClasses[variant],
        className,
      )}
      aria-label="Share this page"
    >
      {copied ? (
        <>
          <Check className="size-4" /> Link copied
        </>
      ) : (
        <>
          <Share2 className="size-4" /> Share
        </>
      )}
    </button>
  );
}
