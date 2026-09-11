import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  PenLine,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Target,
  Timer,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { checkDescriptiveAnswer, type AnswerCheckResult } from "@/lib/answercheck.functions";
import { ShareDialog } from "@/components/ShareDialog";

const TITLE = "Descriptive Answer Checker — AI Marks Your Written Answers";
const DESCRIPTION =
  "Paste a question and your written answer to get AI marking out of your max marks, with a criteria breakdown, missing points and a model answer. Exam mode adds a timer, word limit and a no-paste, no-spellcheck writing box.";
const URL = "https://quizyourpdf.com/descriptive-answer-check";

const FEATURES = [
  {
    icon: Gauge,
    title: "Marks, not vibes",
    body: "Get a score out of your max marks with a criteria-wise breakdown you can actually argue with.",
  },
  {
    icon: Target,
    title: "Missing points called out",
    body: "See exactly which key points your answer skipped before the examiner does.",
  },
  {
    icon: Type,
    title: "Word limit tracking",
    body: "Live word counter that warns you the second you cross your limit.",
  },
  {
    icon: Timer,
    title: "Real exam pressure",
    body: "Exam mode runs a countdown and auto-submits when time's up. No pausing, no vibes.",
  },
  {
    icon: PenLine,
    title: "No paste, no spellcheck",
    body: "The exam box blocks pasting and turns off spellcheck and formatting — just you and the paper.",
  },
  {
    icon: BookOpenCheck,
    title: "Model answer included",
    body: "Every check ends with a full-marks model answer written to your word limit.",
  },
];

export const Route = createFileRoute("/descriptive-answer-check")({
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
  }),
  component: DescriptiveAnswerCheckPage,
});

type Mode = "check" | "exam";
type ExamStage = "setup" | "writing";

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const inputClass =
  "w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60";

type Weights = {
  accuracy: number;
  keyword: number;
  depth: number;
  structure: number;
  conciseness: number;
};

const DEFAULT_WEIGHTS: Weights = {
  accuracy: 40,
  keyword: 25,
  depth: 20,
  structure: 10,
  conciseness: 5,
};

const WEIGHT_META: { key: keyof Weights; label: string; color: string }[] = [
  { key: "accuracy", label: "Factual accuracy", color: "var(--primary)" },
  { key: "keyword", label: "Concept & keyword match", color: "var(--chart-2)" },
  { key: "depth", label: "Analytical depth", color: "var(--chart-3)" },
  { key: "structure", label: "Structure & flow", color: "var(--chart-4)" },
  { key: "conciseness", label: "Conciseness", color: "var(--chart-5)" },
];

function radarPoint(i: number, total: number, value: number, max: number, r: number, cx: number, cy: number) {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
  const radius = (Math.max(0, Math.min(max, value)) / max) * r;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
}

function WeightRadar({ weights }: { weights: Weights }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;
  const labelR = 104;
  const n = WEIGHT_META.length;
  // Extra padding inside the viewBox so side/top labels never clip.
  const padX = 86;
  const padTop = 16;
  const padBottom = 8;

  // Zoom the radar so small weights don't all bunch in the centre.
  // The scale tops out at the highest current weight, but never below 50.
  const maxWeight = Math.max(...Object.values(weights));
  const dataMax = Math.max(50, maxWeight);

  const ring = (frac: number) =>
    WEIGHT_META.map((_, i) => radarPoint(i, n, frac * dataMax, dataMax, r, cx, cy).join(",")).join(" ");
  const poly = WEIGHT_META.map((m, i) => radarPoint(i, n, weights[m.key], dataMax, r, cx, cy).join(",")).join(" ");

  function labelPos(i: number) {
    const [x, y] = radarPoint(i, n, 1, 1, labelR, cx, cy);
    const onRight = x > cx + 2;
    const onLeft = x < cx - 2;
    const dx = onRight ? 4 : onLeft ? -4 : 0;
    const anchor: "start" | "middle" | "end" = onRight ? "start" : onLeft ? "end" : "middle";
    return { x: x + dx, y, anchor };
  }

  return (
    <svg
      viewBox={`${-padX} ${-padTop} ${size + padX * 2} ${size + padTop + padBottom}`}
      className="mx-auto w-full max-w-[360px]"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {WEIGHT_META.map((m, i) => {
        const [x, y] = radarPoint(i, n, 1, 1, r, cx, cy);
        const { x: lx, y: ly, anchor } = labelPos(i);
        return (
          <g key={m.key}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="central"
              className="fill-muted-foreground"
              fontSize="9"
              fontWeight="600"
            >
              {m.label}
            </text>
          </g>
        );
      })}
      <polygon points={poly} fill="oklch(0.88 0.24 128 / 25%)" stroke="var(--primary)" strokeWidth="2" />
      {WEIGHT_META.map((m, i) => {
        const [x, y] = radarPoint(i, n, weights[m.key], dataMax, r, cx, cy);
        return <circle key={m.key} cx={x} cy={y} r="3.5" fill={m.color} />;
      })}
    </svg>
  );
}

function DescriptiveAnswerCheckPage() {
  const [mode, setMode] = useState<Mode>("check");

  // shared inputs
  const [question, setQuestion] = useState("");
  const [maxMarks, setMaxMarks] = useState("10");
  const [wordLimit, setWordLimit] = useState("250");

  // check mode
  const [answer, setAnswer] = useState("");

  // exam mode
  const [maxTime, setMaxTime] = useState("15");
  const [stage, setStage] = useState<ExamStage>("setup");
  const [examAnswer, setExamAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [pasteBlocks, setPasteBlocks] = useState(0);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  // Change one weight and auto-scale the others so the total stays 100%.
  const updateWeight = (key: keyof Weights, rawValue: number) => {
    const value = Math.max(0, Math.min(100, rawValue));
    setWeights((w) => {
      const others = WEIGHT_META.map((m) => m.key).filter((k) => k !== key);
      const otherSum = others.reduce((a, k) => a + w[k], 0);
      const remaining = 100 - value;
      const next = { ...w, [key]: value };
      if (otherSum <= 0) {
        // Other sliders are all 0 — split the remainder evenly.
        const even = Math.floor(remaining / others.length);
        let leftover = remaining - even * others.length;
        for (const k of others) {
          next[k] = even + (leftover > 0 ? 1 : 0);
          leftover -= 1;
        }
        return next;
      }
      // Proportional rescale with rounding, drift fixed on the largest other.
      let drift = remaining;
      for (const k of others) {
        next[k] = Math.round((w[k] / otherSum) * remaining);
        drift -= next[k];
      }
      if (drift !== 0) {
        const biggest = others.reduce((a, b) => (next[a] >= next[b] ? a : b));
        next[biggest] = Math.max(0, next[biggest] + drift);
      }
      return next;
    });
  };

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnswerCheckResult | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const submitRef = useRef<(auto?: boolean) => void>(() => {});

  const activeAnswer = mode === "exam" ? examAnswer : answer;
  const words = useMemo(() => countWords(activeAnswer), [activeAnswer]);
  const limit = Number(wordLimit) || 0;
  const overLimit = limit > 0 && words > limit;

  useEffect(() => {
    if (mode !== "exam" || stage !== "writing") return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          submitRef.current(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [mode, stage]);

  async function runCheck(text: string, timeTaken?: number) {
    const marks = Number(maxMarks);
    if (question.trim().length < 3) {
      toast.error("Add the question first.");
      return;
    }
    if (!text.trim()) {
      toast.error("There's no answer to check.");
      return;
    }
    if (!marks || marks < 1) {
      toast.error("Set the max marks.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await checkDescriptiveAnswer({
        data: {
          question: question.trim(),
          answer: text.trim(),
          maxMarks: marks,
          wordLimit: limit,
          mode,
          ...(timeTaken !== undefined ? { timeTakenSeconds: timeTaken } : {}),
        },
      });
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't check that answer. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function startExam() {
    const mins = Number(maxTime);
    if (question.trim().length < 3) {
      toast.error("Paste the question first.");
      return;
    }
    if (!mins || mins < 1) {
      toast.error("Set a time limit in minutes.");
      return;
    }
    setExamAnswer("");
    setPasteBlocks(0);
    setResult(null);
    setRemaining(mins * 60);
    setStartedAt(Date.now());
    setStage("writing");
  }

  function submitExam(auto = false) {
    const taken = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    setStage("setup");
    if (auto) toast("Time's up — submitting your answer.");
    void runCheck(examAnswer, taken);
  }

  submitRef.current = submitExam;

  const writing = mode === "exam" && stage === "writing";

  return (
    <main className="min-h-screen px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to app</span>
          </Link>
          {!writing && (
            <ShareDialog
              url={URL}
              title={TITLE}
              text="Get your descriptive answers marked by AI 📝"
              label="Share"
            />
          )}
        </header>

        {!writing && (
          <section className="mb-7 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              answer checker
            </span>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              <span className="text-hype">Descriptive answer check</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Drop a question and your answer — get marks, a criteria breakdown and the points you
              missed. Or go exam mode: timer on, paste off.
            </p>
          </section>
        )}

        {/* mode switch */}
        {!writing && (
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card/50 p-1.5">
            {(
              [
                { id: "check", label: "Checking mode", icon: CheckCircle2 },
                { id: "exam", label: "Exam mode", icon: Timer },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setResult(null);
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === m.id
                    ? "bg-primary text-primary-foreground glow-lime"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* ---------- setup / checking form ---------- */}
        {!writing && (
          <section className="surface-card p-4 sm:p-6">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Paste the question here…"
              className={`${inputClass} resize-y`}
            />

            <div className={`mt-4 grid gap-3 ${mode === "exam" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Max marks
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Word limit
                </label>
                <input
                  type="number"
                  min={0}
                  value={wordLimit}
                  onChange={(e) => setWordLimit(e.target.value)}
                  placeholder="0 = none"
                  className={inputClass}
                />
              </div>
              {mode === "exam" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Max time (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxTime}
                    onChange={(e) => setMaxTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {/* advanced evaluation settings */}
            <div className="mt-4 rounded-2xl border border-border bg-background/40">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Advanced evaluation settings
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>
              {showAdvanced && (
                <div className="grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    {WEIGHT_META.map((m) => (
                      <div key={m.key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                            {m.label}
                          </span>
                          <span className="font-display font-bold text-primary">{weights[m.key]}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={weights[m.key]}
                          onChange={(e) =>
                            setWeights((w) => ({ ...w, [m.key]: Number(e.target.value) }))
                          }
                          className="w-full accent-[oklch(0.88_0.24_128)]"
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span
                        className={`text-xs font-semibold ${
                          Object.values(weights).reduce((a, b) => a + b, 0) === 100
                            ? "text-primary"
                            : "text-warning"
                        }`}
                      >
                        total: {Object.values(weights).reduce((a, b) => a + b, 0)}%
                        {Object.values(weights).reduce((a, b) => a + b, 0) !== 100 && " (aim for 100%)"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWeights(DEFAULT_WEIGHTS)}
                        className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        reset defaults
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <WeightRadar weights={weights} />
                    <p className="mt-1 text-center text-[11px] text-muted-foreground">
                      live weight radar — tweaks apply to your next check
                    </p>
                  </div>
                </div>
              )}
            </div>

            {mode === "check" ? (
              <>
                <div className="mt-4 mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Your answer
                  </label>
                  <span
                    className={`text-xs font-semibold ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {words}
                    {limit > 0 ? ` / ${limit}` : ""} words
                  </span>
                </div>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={10}
                  placeholder="Paste or type your written answer…"
                  className={`${inputClass} resize-y leading-relaxed`}
                />
                <button
                  onClick={() => void runCheck(answer)}
                  disabled={loading}
                  className="glow-lime mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Marking your answer…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Check my answer
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Exam mode rules:</span> the timer
                  starts the second you hit start, pasting is blocked, spellcheck and formatting are
                  off, and your answer auto-submits when time runs out.
                </div>
                <button
                  onClick={startExam}
                  disabled={loading}
                  className="glow-lime mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Marking your answer…
                    </>
                  ) : (
                    <>
                      <Timer className="h-4 w-4" /> Start exam
                    </>
                  )}
                </button>
              </>
            )}
          </section>
        )}

        {/* ---------- exam writing screen ---------- */}
        {writing && (
          <section className="surface-card p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                    remaining <= 60
                      ? "bg-destructive/15 text-destructive"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  {fmt(remaining)}
                </span>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {maxMarks} marks
                </span>
              </div>
              <span
                className={`text-xs font-semibold ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
              >
                {words}
                {limit > 0 ? ` / ${limit}` : ""} words
              </span>
            </div>

            <p className="mb-3 rounded-xl border border-border bg-background/50 p-3 text-sm leading-relaxed text-foreground">
              {question}
            </p>

            <textarea
              autoFocus
              value={examAnswer}
              onChange={(e) => setExamAnswer(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setPasteBlocks((n) => n + 1);
                toast.error("Pasting is disabled in exam mode.");
              }}
              onDrop={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              data-gramm="false"
              rows={14}
              placeholder="Start writing your answer…"
              className={`${inputClass} resize-none font-normal leading-relaxed`}
            />

            {pasteBlocks > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {pasteBlocks} paste attempt{pasteBlocks > 1 ? "s" : ""} blocked
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => submitExam(false)}
                className="glow-lime inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Submit answer
              </button>
              <button
                onClick={() => {
                  setStage("setup");
                  setExamAnswer("");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Quit
              </button>
            </div>
          </section>
        )}

        {/* ---------- result ---------- */}
        {result && !writing && (
          <section ref={resultRef} className="mt-6 space-y-4">
            <div className="surface-card p-4 text-center sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                your score
              </p>
              <p className="mt-1 text-5xl font-bold text-hype">
                {result.marks}
                <span className="text-2xl text-muted-foreground">/{maxMarks}</span>
              </p>
              {result.grade && (
                <p className="mt-1 text-sm font-semibold text-primary">Grade {result.grade}</p>
              )}
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{result.verdict}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    result.overLimit
                      ? "border-destructive/40 text-destructive"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {result.wordCount}
                  {result.wordLimit > 0 ? ` / ${result.wordLimit}` : ""} words
                </span>
                {result.timeTakenSeconds !== undefined && (
                  <span className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground">
                    took {fmt(result.timeTakenSeconds)}
                  </span>
                )}
              </div>
            </div>

            {result.breakdown.length > 0 && (
              <div className="surface-card p-4 sm:p-6">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  marks breakdown
                </h2>
                <div className="space-y-3">
                  {result.breakdown.map((b, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-foreground">{b.criterion}</span>
                        <span className="shrink-0 font-bold tabular-nums text-primary">
                          {b.score}/{b.outOf}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${b.outOf > 0 ? Math.min(100, (b.score / b.outOf) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      {b.comment && (
                        <p className="mt-1 text-xs text-muted-foreground">{b.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {result.strengths.length > 0 && (
                <div className="surface-card p-4">
                  <h2 className="mb-2 text-sm font-bold text-success">what worked</h2>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {result.strengths.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.improvements.length > 0 && (
                <div className="surface-card p-4">
                  <h2 className="mb-2 text-sm font-bold text-warning">fix this next time</h2>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {result.improvements.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {result.missingPoints.length > 0 && (
              <div className="surface-card p-4 sm:p-6">
                <h2 className="mb-2 text-sm font-bold text-destructive">points you missed</h2>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {result.missingPoints.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.modelAnswer && (
              <div className="surface-card p-4 sm:p-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  model answer
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {result.modelAnswer}
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setResult(null);
                setAnswer("");
                setExamAnswer("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" /> Check another answer
            </button>
          </section>
        )}

        {/* ---------- features ---------- */}
        {!writing && (
          <section className="mt-10">
            <h2 className="mb-4 text-center text-lg font-bold">why it slaps</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="surface-card p-4 transition-transform hover:-translate-y-0.5"
                >
                  <f.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-2 text-sm font-bold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
