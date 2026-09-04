import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Upload,
  Brain,
  SlidersHorizontal,
  Gamepad2,
  ShieldCheck,
  Trophy,
  ArrowLeft,
  Zap,
  CalendarDays,
  Download,
  ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How QuizLab Works — From PDF to Game" },
      {
        name: "description",
        content:
          "See how QuizLab turns your PDF notes into an AI-generated quiz game with timers, difficulty levels, streaks and fact-checking.",
      },
      { property: "og:title", content: "How QuizLab Works — From PDF to Game" },
      {
        property: "og:description",
        content:
          "Upload a PDF, pick your settings, and play an AI-built quiz with instant feedback and source-backed fact-checks.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://quizyourpdf.com/how-it-works" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://quizyourpdf.com/how-it-works" }],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: Upload,
    title: "Drop your PDF",
    body: "Upload your notes, slides, textbook chapter — any PDF with readable text. We read the whole thing, no page cap.",
  },
  {
    icon: SlidersHorizontal,
    title: "Set the vibe",
    body: "Pick how many questions you want, how much time you get, and the difficulty: Chill, Mid or Brutal.",
  },
  {
    icon: Brain,
    title: "AI builds the quiz",
    body: "Our AI reads your material and crafts multiple-choice questions that actually match what you uploaded.",
  },
  {
    icon: Gamepad2,
    title: "Play it like a game",
    body: "Race the timer, build streaks, and get instant feedback. Practice mode reveals answers after each question; Exam mode keeps it locked until the end.",
  },
  {
    icon: ShieldCheck,
    title: "Fact-check everything",
    body: "Each question is cross-checked against real sources. Get a confidence score, evidence bullets, and suggested corrections if anything looks sus.",
  },
  {
    icon: Trophy,
    title: "Review & improve",
    body: "See your score, topic breakdown and per-question analysis. Study the facts you missed and run it again.",
  },
];

const PLAN_STEPS = [
  {
    icon: CalendarDays,
    title: "Set your timeline",
    body: "Enter your exam name, weeks left, study days per week, and hours per day. The planner calculates your total available study hours automatically.",
  },
  {
    icon: Upload,
    title: "Drop your syllabus",
    body: "Paste the syllabus text or upload a PDF of your course outline. The AI pulls out the real topics — no generic filler.",
  },
  {
    icon: ListChecks,
    title: "Get your weekly plan",
    body: "Receive a week-by-week schedule with color-coded priority topics, milestones, and a built-in revision tracker for each topic.",
  },
  {
    icon: Download,
    title: "Download & grind",
    body: "Export a printable PDF with checkboxes for 1st, 2nd and 3rd revisions next to every topic. Stick it on your wall and start checking boxes.",
  },
];

function HowItWorksPage() {
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
            how it <span className="text-hype">works</span>
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Your notes → AI quiz → game mode studying. No cap.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="surface-card space-y-3 p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
                  <step.icon className="size-5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <h2 className="font-display text-lg font-bold">{step.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="surface-card glow-lime space-y-4 p-6 text-center">
          <h2 className="font-display text-xl font-bold">ready to turn studying into a game?</h2>
          <p className="text-sm text-muted-foreground">
            Upload your first PDF and see what the AI cooks up.
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
