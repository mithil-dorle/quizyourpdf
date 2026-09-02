import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Clock,
  Download,
  FileUp,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { extractPdfText } from "@/lib/pdf";
import { generateStudyPlan, type StudyPlan } from "@/lib/studyplan.functions";
import { downloadStudyPlanPdf } from "@/lib/studyplan-pdf";

const TITLE = "Study Guide Generator — AI Study Schedule You Can Download";
const DESCRIPTION =
  "Free AI study guide generator: paste your syllabus or drop a PDF and get a day-by-day, colour-coded study schedule with revision checkboxes you can download as a PDF.";
const URL = "https://quizyourpdf.com/study-guide-generator";

const LEVELS = [
  { id: "Starting from scratch", label: "from scratch" },
  { id: "Halfway there", label: "halfway there" },
  { id: "Mostly revision", label: "mostly revision" },
];

const LOADING_COPY = [
  "Analyzing syllabus...",
  "Ranking high-yield topics...",
  "Calculating optimal time slots...",
  "Applying spaced repetition...",
  "Locking in your plan...",
];

const faqs = [
  {
    q: "Is this study guide generator free?",
    a: "Yes. Paste a syllabus or drop a PDF and download your study plan without creating an account.",
  },
  {
    q: "What does the downloadable PDF include?",
    a: "A header with your exam name, countdown and total study hours, a day-by-day table split into time slots, colour-coded topic priorities, and three revision checkboxes next to every topic.",
  },
  {
    q: "How is this different from a summary tool?",
    a: "It doesn't just summarise. It builds a schedule: what to study on which day, in which slot, with spaced-repetition revision built in.",
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

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-success/15 text-success border-success/30",
};

function StudyGuideGeneratorPage() {
  const [exam, setExam] = useState("");
  const [days, setDays] = useState(14);
  const [daysInput, setDaysInput] = useState(String(days));
  const [hours, setHours] = useState(3);
  const [level, setLevel] = useState(LEVELS[1]!.id);
  const [syllabus, setSyllabus] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyIndex, setCopyIndex] = useState(0);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    setCopyIndex(0);
    const id = setInterval(() => setCopyIndex((i) => (i + 1) % LOADING_COPY.length), 1800);
    return () => clearInterval(id);
  }, [loading]);

  const clampDays = (n: number) => Math.max(1, Math.min(365, Number.isNaN(n) ? 1 : n));

  const commitDays = (raw: string) => {
    const n = clampDays(Number(raw));
    setDays(n);
    setDaysInput(String(n));
  };

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("that's not a PDF. drop a .pdf file or paste the syllabus instead.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("file's too chunky (max 25MB).");
      return;
    }
    setError("");
    setParsing(true);
    try {
      const text = await extractPdfText(file);
      if (text.trim().length < 50) {
        setError("couldn't read text from that PDF — might be a scan. paste the syllabus instead.");
        return;
      }
      setSyllabus(text);
      setFileName(file.name);
    } catch {
      setError("that PDF wouldn't open. try another one or paste the text.");
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    if (!exam.trim()) return setError("give your exam a name first.");
    if (syllabus.trim().length < 20) return setError("paste your syllabus or drop a PDF first.");
    setError("");
    setLoading(true);
    try {
      const result = await generateStudyPlan({
        data: { exam: exam.trim(), days, hoursPerDay: hours, level, syllabus },
      });
      setPlan(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "the AI tapped out. try again.");
    } finally {
      setLoading(false);
    }
  }

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

      {plan ? (
        <PlanView
          plan={plan}
          exam={exam}
          days={days}
          hours={hours}
          onReset={() => setPlan(null)}
        />
      ) : (
        <>
          <section className="space-y-4 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5" />
              Free · no signup
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.05] sm:text-5xl">
              study guide <span className="text-hype">generator</span>
            </h1>
            <p className="mx-auto max-w-lg text-sm text-muted-foreground sm:text-base">
              Tell it your exam, your syllabus and how many hours you actually have. Get a
              day-by-day plan with colour-coded priorities and revision checkboxes — downloadable
              as a PDF.
            </p>
          </section>

          {loading ? (
            <div className="surface-card glow-lime mt-10 flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="font-display text-lg font-bold">{LOADING_COPY[copyIndex]}</p>
              <p className="text-xs text-muted-foreground">
                building {Math.min(days, 30)} days · {hours}h/day · locked to your syllabus
              </p>
            </div>
          ) : (
            <section className="surface-card mt-10 space-y-6 p-5 sm:p-6">
              <div className="space-y-2">
                <label htmlFor="exam" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  exam name
                </label>
                <input
                  id="exam"
                  value={exam}
                  onChange={(e) => setExam(e.target.value)}
                  maxLength={120}
                  placeholder="Organic Chemistry Final"
                  className="w-full rounded-xl border border-input bg-background/40 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="days" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="size-3.5" /> days left
                  </label>
                  <input
                    id="days"
                    type="number"
                    min={1}
                    max={120}
                    value={daysInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDaysInput(raw);
                      const n = Number(raw);
                      if (!Number.isNaN(n) && raw !== "") setDays(clampDays(n));
                    }}
                    onBlur={() => commitDays(daysInput)}
                    className="w-full rounded-xl border border-input bg-background/40 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="hours" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Clock className="size-3.5" /> hours per day · <span className="text-primary">{hours}h</span>
                  </label>
                  <input
                    id="hours"
                    type="range"
                    min={1}
                    max={18}
                    value={hours}
                    aria-label="Hours available to study per day"
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Target className="size-3.5" /> current level
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLevel(l.id)}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                        level === l.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  syllabus
                </span>
                <textarea
                  value={syllabus}
                  onChange={(e) => {
                    setSyllabus(e.target.value);
                    setFileName("");
                  }}
                  rows={6}
                  placeholder="Paste your syllabus, unit list or chapter names here..."
                  className="w-full resize-y rounded-xl border border-input bg-background/40 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
                <div className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  or
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                    dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  {parsing ? (
                    <Loader2 className="size-6 animate-spin text-primary" />
                  ) : (
                    <FileUp className="size-6 text-primary" />
                  )}
                  <span className="text-sm font-bold">
                    {parsing ? "reading your PDF..." : fileName || "drop your syllabus PDF here"}
                  </span>
                  <span className="text-xs text-muted-foreground">PDF only · max 25MB</span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void submit()}
                className="w-full rounded-xl bg-primary px-5 py-3.5 font-display text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Generate Smart Study Plan
              </button>
            </section>
          )}

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
              . Or see{" "}
              <Link to="/how-it-works" className="font-medium text-foreground underline">
                how it works
              </Link>
              .
            </p>
          </section>
        </>
      )}
    </main>
  );
}

function PlanView({
  plan,
  exam,
  days,
  hours,
  onReset,
}: {
  plan: StudyPlan;
  exam: string;
  days: number;
  hours: number;
  onReset: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const totalHours = plan.days.length * hours;

  return (
    <div className="space-y-6">
      <section className="surface-card glow-lime space-y-4 p-5 sm:p-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{plan.title}</h1>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "exam", value: exam },
            { label: "days left", value: String(days) },
            { label: "total hours", value: `${totalHours}h` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border p-3">
              <div className="truncate font-display text-base font-bold">{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadStudyPlanPdf({ plan, exam, days, hoursPerDay: hours });
              } finally {
                setDownloading(false);
              }
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download PDF
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-4" />
            New plan
          </button>
        </div>
      </section>

      {plan.strategy.length > 0 && (
        <section className="surface-card space-y-2 p-5">
          <h2 className="font-display text-lg font-bold">the game plan</h2>
          <ul className="space-y-1.5">
            {plan.strategy.map((s) => (
              <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary">→</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span className="rounded-full border border-destructive/30 bg-destructive/15 px-2.5 py-1 text-destructive">
          high yield
        </span>
        <span className="rounded-full border border-warning/30 bg-warning/15 px-2.5 py-1 text-warning">
          medium
        </span>
        <span className="rounded-full border border-success/30 bg-success/15 px-2.5 py-1 text-success">
          quick read
        </span>
      </div>

      <section className="space-y-3">
        {plan.days.map((day) => (
          <div key={day.day} className="surface-card space-y-3 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-lg font-bold">Day {day.day}</h3>
              <span className="truncate text-xs text-muted-foreground">{day.focus}</span>
            </div>
            <div className="space-y-3">
              {day.slots.map((slot, si) => (
                <div key={`${day.day}-${si}`} className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    {slot.slot}
                  </div>
                  {slot.items.map((item, ii) => (
                    <div
                      key={`${day.day}-${si}-${ii}`}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2.5"
                    >
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE["medium"]
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {item.topic}
                        {item.note && (
                          <span className="block text-xs text-muted-foreground">{item.note}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.minutes}m</span>
                      <span className="flex items-center gap-1 text-muted-foreground/60">
                        <CheckSquare className="size-3.5" />
                        <CheckSquare className="size-3.5" />
                        <CheckSquare className="size-3.5" />
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
