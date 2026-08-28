import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap, HelpCircle, FileText, Brain, Clock, ShieldCheck, Sparkles } from "lucide-react";

const FAQS = [
  {
    icon: FileText,
    question: "What kind of PDFs can I upload?",
    answer:
      "Any PDF with readable text works — notes, slides, textbook chapters, even scanned docs if the text layer is there. We read the whole PDF, so go ahead and drop that 200-page unit.",
  },
  {
    icon: Brain,
    question: "How does the AI generate the quiz?",
    answer:
      "The AI reads your PDF, picks out key concepts, and turns them into multiple-choice questions. You choose the number of questions, difficulty, and time limit before it cooks.",
  },
  {
    icon: Clock,
    question: "How long does fact-checking take?",
    answer:
      "Usually a few seconds per question. We keep answers short and run checks in parallel, so even a full exam review finishes fast. If a source is slow, we still show you the AI verdict and reasoning.",
  },
  {
    icon: ShieldCheck,
    question: "What does the confidence score mean?",
    answer:
      "It’s a 0–100 score showing how sure the fact-check is based on available sources. A high score means the evidence is solid; a low score means the topic is niche or sources disagree.",
  },
  {
    icon: Sparkles,
    question: "Can I use QuizLab for exam prep?",
    answer:
      "Absolutely. Exam mode hides answers until the end and gives you a full breakdown with topic accuracy, skipped questions, and bulk fact-checking after you submit.",
  },
  {
    icon: HelpCircle,
    question: "Is my PDF stored anywhere?",
    answer:
      "Nope. Your PDF is processed in your browser session and not saved on our servers. Quiz data lives locally while you play.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — QuizLab" },
      {
        name: "description",
        content:
          "Got questions about uploading PDFs, AI quiz generation, or fact-check timing? Find the answers here.",
      },
      { property: "og:title", content: "FAQ — QuizLab" },
      {
        property: "og:description",
        content:
          "Common questions about PDF uploads, quiz generation, and how QuizLab fact-checks your answers.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://quiz-genie-77.lovable.app/faq" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://quiz-genie-77.lovable.app/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(faqJsonLd),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">QuizLab</span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to app
        </Link>
      </header>

      <section className="space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl">
            questions? <span className="text-hype">answered.</span>
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Everything you need to know about PDFs, quizzes, and fact-checks.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="surface-card group overflow-hidden rounded-2xl open:ring-1 open:ring-primary/20"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 p-5 outline-none transition-colors hover:bg-accent/30">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
                  <faq.icon className="size-5" />
                </span>
                <span className="flex-1 font-display text-base font-bold sm:text-lg">
                  {faq.question}
                </span>
                <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-5 pt-0">
                <p className="pl-12 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            </details>
          ))}
        </div>

        <div className="surface-card glow-lime space-y-4 p-6 text-center">
          <h2 className="font-display text-xl font-bold">still curious?</h2>
          <p className="text-sm text-muted-foreground">
            The fastest way to learn is to try it. Upload a PDF and see the magic.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start quizzing
          </Link>
        </div>
      </section>
    </main>
  );
}
