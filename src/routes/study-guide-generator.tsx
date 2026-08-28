import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Brain,
  Clock,
  FileUp,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

const TITLE = "Study Guide Generator — Turn Any PDF Into a Study Guide";
const DESCRIPTION =
  "Free AI study guide generator: upload lecture notes or a textbook PDF and get a quiz-style study guide with timers, difficulty levels and fact-checked answers.";
const URL = "https://quizyourpdf.com/study-guide-generator";

const FEATURES = [
  {
    icon: FileUp,
    title: "Works with your own material",
    body: "Upload lecture slides, class notes or a textbook chapter as a PDF. The generator reads every page — no page cap.",
  },
  {
    icon: Brain,
    title: "AI writes the study questions",
    body: "Instead of a wall of summary text, you get multiple-choice questions drawn straight from your document, so you study by recalling.",
  },
  {
    icon: Target,
    title: "Three difficulty levels",
    body: "Chill for quick recall, Mid for real studying, Brutal when the exam is tomorrow and you need no mercy.",
  },
  {
    icon: Clock,
    title: "Timed or untimed",
    body: "Set a time limit per question to simulate exam pressure, or leave it relaxed while you learn the material.",
  },
  {
    icon: ShieldCheck,
    title: "Fact-checked answers",
    body: "Every question is cross-checked with a confidence score, supporting evidence and source links, so a bad question never sneaks into your revision.",
  },
  {
    icon: ListChecks,
    title: "Study guide you can review",
    body: "After the run you get a topic breakdown, per-question analysis and the saved fact-checks — a study guide built from your own weak spots.",
  },
];

const STEPS = [
  "Upload your PDF study material.",
  "Choose question count, timer, difficulty and Practice or Exam mode.",
  "The AI generates your study guide as a playable quiz.",
  "Review the breakdown, then regenerate a fresh set from the same PDF.",
];

const faqs = [
  {
    q: "Is this study guide generator free?",
    a: "Yes. Upload a PDF and generate a study guide quiz without creating an account.",
  },
  {
    q: "What kind of study material works best?",
    a: "Any text-based PDF: lecture notes, slide decks, textbook chapters or research papers. Scanned image-only PDFs won't work because there's no readable text to pull from.",
  },
  {
    q: "How is this different from a summary tool?",
    a: "Summaries let you read passively. This generator turns your material into active-recall questions with instant feedback, which is far better for retention before an exam.",
  },
];

export const Route = createFileRoute("/study-guide-generator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: StudyGuideGeneratorPage,
});

function StudyGuideGeneratorPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-5 sm:py-10">
      <header className="mb-8 flex items-center justify-between">
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

      <section className="space-y-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5" />
          Free · no signup
        </span>
        <h1 className="font-display text-3xl font-bold leading-[1.05] sm:text-5xl">
          study guide <span className="text-hype">generator</span>
        </h1>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground sm:text-base">
          Drop in your PDF notes and get an AI-generated study guide you actually play:
          multiple-choice questions, timers, difficulty levels and fact-checked answers.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Generate my study guide
        </Link>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl font-bold">what you get</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card space-y-3 p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
                <f.icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl font-bold">how to generate a study guide</h2>
        <ol className="surface-card space-y-3 p-5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm text-muted-foreground">
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Want the full breakdown?{" "}
          <Link to="/how-it-works" className="font-medium text-foreground underline">
            See how it works
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-display text-2xl font-bold">questions people ask</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="surface-card space-y-2 p-5">
              <h3 className="font-display text-base font-bold">{f.q}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          More answers on the{" "}
          <Link to="/faq" className="font-medium text-foreground underline">
            FAQ page
          </Link>
          .
        </p>
      </section>

      <section className="surface-card glow-lime mt-12 space-y-4 p-6 text-center">
        <h2 className="font-display text-xl font-bold">turn your notes into a study guide now</h2>
        <p className="text-sm text-muted-foreground">
          One PDF is all it takes. The AI handles the rest.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Upload a PDF
        </Link>
      </section>
    </main>
  );
}
