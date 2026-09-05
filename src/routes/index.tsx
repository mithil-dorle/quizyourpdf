import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  ClipboardList,
  Clock,
  Gamepad2,
  SkipForward,
  FileUp,
  Flame,
  Link as LinkIcon,
  Loader2,
  Pause,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { extractPdfText } from "@/lib/pdf";
import { generateQuiz, type Quiz, type QuizQuestion } from "@/lib/quiz.functions";
import { factCheckQuestion, type FactCheck } from "@/lib/factcheck.functions";
import { FeedbackForm } from "@/components/FeedbackForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDF to Quiz Generator — QuizLab" },
      {
        name: "description",
        content:
          "Upload a PDF and get an AI-built multiple-choice quiz in seconds, with timers, difficulty levels, streaks and fact-checked answers.",
      },
      { property: "og:title", content: "PDF to Quiz Generator — QuizLab" },
      {
        property: "og:description",
        content:
          "Turn your notes into a timed AI quiz: pick question count, difficulty and mode, then play with instant fact-checked feedback.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://quizyourpdf.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://quizyourpdf.com/" }],
  }),
  component: Index,
});

type Stage = "upload" | "playing" | "results";
type Difficulty = "chill" | "mid" | "brutal";
type Mode = "practice" | "exam";

const DIFFICULTIES: { id: Difficulty; label: string; sub: string }[] = [
  { id: "chill", label: "Chill", sub: "easy recall" },
  { id: "mid", label: "Mid", sub: "real studying" },
  { id: "brutal", label: "Brutal", sub: "exam boss mode" },
];

const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: "practice", label: "Practice", sub: "answers + fact-check instantly" },
  { id: "exam", label: "Exam", sub: "everything revealed at the end" },
];


function Index() {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [count, setCount] = useState(8);
  const [minutes, setMinutes] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [mode, setMode] = useState<Mode>("practice");


  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [factChecks, setFactChecks] = useState<Record<number, FactCheck>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const makeQuiz = useServerFn(generateQuiz);
  const prefetchCheck = useServerFn(factCheckQuestion);
  const prefetching = useRef<Set<number>>(new Set());

  // Warm the fact-check cache for the current + next question while the user is still reading,
  // so the panel is instant once they lock in an answer.
  useEffect(() => {
    if (stage !== "playing" || !quiz) return;
    for (const i of [current, current + 1]) {
      const q = quiz.questions[i];
      if (!q || factChecks[i] || prefetching.current.has(i)) continue;
      prefetching.current.add(i);
      prefetchCheck({
        data: { question: q.question, options: q.options, correctIndex: q.correctIndex },
      })
        .then((r) => setFactChecks((prev) => (prev[i] ? prev : { ...prev, [i]: r })))
        .catch(() => prefetching.current.delete(i));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, quiz, current]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const MAX_MB = 25;
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()!.toUpperCase()
        : "that";
      setError(`${ext} files aren't supported yet — drop a .pdf instead.`);
      return;
    }
    if (file.size === 0) {
      setError("That file is empty (0 KB). Try re-exporting your PDF.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        `Too chunky: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is ${MAX_MB} MB — split it up and try again.`,
      );
      return;
    }
    setBusy("Reading your PDF…");
    try {
      const text = await Promise.race([
        extractPdfText(file),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 60_000),
        ),
      ]);
      if (text.trim().length < 200) {
        setError(
          "No readable text in there — looks like scanned images. Try a text-based PDF.",
        );
        setBusy(null);
        return;
      }
      setPdfText(text);
      setFileName(file.name);
    } catch (e) {
      const msg = e instanceof Error ? `${e.name} ${e.message}` : "";
      if (/timeout/i.test(msg)) {
        setError("That PDF took too long (60s+). Try a smaller or shorter file.");
      } else if (/password|Password/.test(msg)) {
        setError("That PDF is password-protected. Unlock it, then re-upload.");
      } else if (/Invalid|corrupt|structure/i.test(msg)) {
        setError("That file looks corrupted or isn't a real PDF. Try another one.");
      } else {
        setError("Couldn't read that file. Try another PDF.");
      }
    }
    setBusy(null);
  }, []);


  const start = async () => {
    setError(null);
    setBusy("Cooking your quiz…");
    try {
      const result = await makeQuiz({
        data: { text: pdfText, count, difficulty },
      });
      if (!result.questions.length) throw new Error("No questions came back.");
      setQuiz(result);
      setAnswers(Array(result.questions.length).fill(null));
      setCurrent(0);
      setRevealed(false);
      setStreak(0);
      setBestStreak(0);
      setSecondsLeft(minutes * 60);
      setFactChecks({});
      setStage("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something broke. Try again.");
    }
    setBusy(null);
  };

  useEffect(() => {
    if (stage !== "playing") return;
    if (revealed && mode === "practice") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setStage("results");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [stage, revealed, mode]);

  const questions = quiz?.questions ?? [];
  const score = useMemo(
    () => answers.filter((a, i) => a !== null && a === questions[i]?.correctIndex).length,
    [answers, questions],
  );

  const pick = (index: number) => {
    if (revealed) return;
    const next = [...answers];
    next[current] = index;
    setAnswers(next);
    if (mode === "exam") return;
    setRevealed(true);
    const correct = index === questions[current]?.correctIndex;
    setStreak((s) => {
      const value = correct ? s + 1 : 0;
      setBestStreak((b) => Math.max(b, value));
      return value;
    });
  };

  const goTo = (i: number) => {
    setCurrent(Math.max(0, Math.min(questions.length - 1, i)));
    setRevealed(false);
  };

  const skip = () => {
    const nextAnswers = [...answers];
    nextAnswers[current] = null;
    setAnswers(nextAnswers);
    next();
  };

  const next = () => {
    if (current + 1 >= questions.length) {
      setStage("results");
      return;
    }
    setCurrent((c) => c + 1);
    setRevealed(false);
  };


  const reset = () => {
    setStage("upload");
    setQuiz(null);
    setPdfText("");
    setFileName(null);
  };

  const [regenerating, setRegenerating] = useState(false);
  const regenerate = async () => {
    setRegenerating(true);
    await start();
    setRegenerating(false);
  };


  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-5 sm:py-10">
      <header className="mb-6 flex items-center justify-between sm:mb-10">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">QuizLab</span>
        </div>
        <Badge
          variant="outline"
          className="hidden rounded-full border-accent/40 text-accent sm:inline-flex"
        >
          study, but a game
        </Badge>
      </header>

      {stage === "upload" && (
        <section className="space-y-8">
          <div className="space-y-3 text-center">
            <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
              drop a PDF.
              <br />
              <span className="text-hype">get quizzed.</span>
            </h1>
            <p className="mx-auto max-w-md text-muted-foreground">
              Your notes go in, an AI-built quiz comes out — with timers, streaks and
              feedback that actually explains stuff.
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className="surface-card glow-lime cursor-pointer p-6 text-center transition-transform hover:-translate-y-0.5 sm:p-10"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <FileUp className="mx-auto mb-3 size-8 text-primary" />
            <p className="font-display text-lg font-bold">
              {fileName ?? "Drop your PDF here"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {fileName ? "locked in — tweak the settings below" : "or tap to browse — text-based .pdf, up to 25 MB"}
            </p>

          </div>

          <div className="surface-card space-y-7 p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Quiz settings</h2>

            <SettingRow icon={<Target className="size-4" />} label="Questions" value={`${count}`}>
              <Slider
                aria-label="Number of questions"
                value={[count]}
                min={3}
                max={20}
                step={1}
                onValueChange={(v) => setCount(v[0] ?? 8)}
              />
            </SettingRow>

            <SettingRow
              icon={<Clock className="size-4" />}
              label="Time limit"
              value={`${minutes} min`}
            >
              <Slider
                aria-label="Time limit in minutes"
                value={[minutes]}
                min={1}
                max={30}
                step={1}
                onValueChange={(v) => setMinutes(v[0] ?? 5)}
              />
            </SettingRow>

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Flame className="size-4" /> Difficulty
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={cn(
                      "min-w-0 rounded-2xl border px-3 py-3 text-center transition-colors sm:text-left",
                      difficulty === d.id
                        ? "border-primary/60 bg-primary/15"
                        : "border-border bg-secondary/40 hover:bg-secondary",
                    )}
                  >
                    <span className="block font-display font-bold">{d.label}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{d.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardList className="size-4" /> Mode
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left transition-colors",
                      mode === m.id
                        ? "border-accent/60 bg-accent/15"
                        : "border-border bg-secondary/40 hover:bg-secondary",
                    )}
                  >
                    <span className="block font-display font-bold">{m.label}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-bold"
            disabled={!pdfText || !!busy}
            onClick={start}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" /> {busy}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-5" /> Generate my quiz
              </>
            )}
          </Button>

          <HowItWorksMini />
          <TestimonialsMini />
          <FeedbackForm className="mt-2" />
        </section>
      )}

      {stage === "playing" && questions[current] && (
        <QuizPlay
          quiz={quiz!}
          mode={mode}
          index={current}
          answers={answers}
          answer={answers[current] ?? null}
          revealed={revealed}
          streak={streak}
          score={score}
          secondsLeft={secondsLeft}
          factCheck={factChecks[current] ?? null}
          onFactCheck={(i, c) => setFactChecks((prev) => ({ ...prev, [i]: c }))}
          onPick={pick}
          onNext={next}
          onSkip={skip}
          onJump={goTo}
          onSubmit={() => setStage("results")}
        />
      )}

      {stage === "results" && quiz && (
        <Results
          quiz={quiz}
          mode={mode}
          answers={answers}
          score={score}
          bestStreak={bestStreak}
          factChecks={factChecks}
          onFactCheck={(i, c) => setFactChecks((prev) => ({ ...prev, [i]: c }))}
          onReset={reset}
          onRegenerate={regenerate}
          regenerating={regenerating}
          canRegenerate={pdfText.trim().length > 0}
        />
      )}



    </main>
  );
}

const HOW_STEPS = [
  {
    icon: Upload,
    title: "Drop your PDF",
    body: "Upload notes, slides or any text-based PDF — no page cap.",
  },
  {
    icon: SlidersHorizontal,
    title: "Set the vibe",
    body: "Pick question count, time limit, difficulty and mode.",
  },
  {
    icon: Brain,
    title: "AI builds it",
    body: "Our AI reads your material and crafts multiple-choice questions.",
  },
  {
    icon: Gamepad2,
    title: "Play & learn",
    body: "Race the timer, build streaks, and get instant feedback.",
  },
  {
    icon: ShieldCheck,
    title: "Fact-checked",
    body: "Each answer is cross-checked with sources and confidence scores.",
  },
];

function HowItWorksMini() {
  return (
    <div className="surface-card space-y-5 p-5 sm:p-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold">
          how it <span className="text-hype">works</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          from PDF to game-mode studying in four taps
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {HOW_STEPS.map((step) => (
          <div key={step.title} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <step.icon className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold">{step.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TESTIMONIALS = [
  {
    name: "Ava R.",
    role: "Bio major",
    avatar: "AR",
    color: "bg-primary text-primary-foreground",
    stars: 5,
    quote: "I uploaded my 60-page anatomy notes and got a fire quiz in like 30 seconds. The fact-check actually caught a sus question.",
  },
  {
    name: "Marcus T.",
    role: "CS student",
    avatar: "MT",
    color: "bg-accent text-accent-foreground",
    stars: 5,
    quote: "Exam mode hits different. No spoilers, full breakdown at the end, and I can finally trust the source confidence scores.",
  },
  {
    name: "Priya K.",
    role: "High school senior",
    avatar: "PK",
    color: "bg-secondary text-secondary-foreground",
    stars: 5,
    quote: "I actually look forward to reviewing now. The questions feel like they came straight from my own notes — because they did.",
  },
];

function TestimonialsMini() {
  return (
    <div className="surface-card space-y-5 p-5 sm:p-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold">
          the <span className="text-hype">vibe check</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          real students who turned their notes into a game
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-4 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <span className={cn("grid size-10 place-items-center rounded-full font-display text-sm font-bold", t.color)}>
                {t.avatar}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-3.5",
                    i < t.stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40",
                  )}
                />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">"{t.quote}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-muted-foreground">
          {icon} {label}
        </span>
        <span className="font-display font-bold text-primary">{value}</span>
      </div>
      {children}
    </div>
  );
}

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function QuizPlay({
  quiz,
  mode,
  index,
  answers,
  answer,
  revealed,
  streak,
  score,
  secondsLeft,
  factCheck,
  onFactCheck,
  onPick,
  onNext,
  onSkip,
  onJump,
  onSubmit,
}: {
  quiz: Quiz;
  mode: Mode;
  index: number;
  answers: (number | null)[];
  answer: number | null;
  revealed: boolean;
  streak: number;
  score: number;
  secondsLeft: number;
  factCheck: FactCheck | null;
  onFactCheck: (index: number, check: FactCheck) => void;
  onPick: (i: number) => void;
  onNext: () => void;
  onSkip: () => void;
  onJump: (i: number) => void;
  onSubmit: () => void;
}) {
  const q = quiz.questions[index]!;
  const correct = answer === q.correctIndex;
  const low = secondsLeft <= 30;
  const exam = mode === "exam";
  const answeredCount = answers.filter((a) => a !== null).length;
  const last = index + 1 >= quiz.questions.length;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="shrink-0 rounded-full">
            Q{index + 1}/{quiz.questions.length}
          </Badge>
          {exam && (
            <Badge className="rounded-full bg-accent text-accent-foreground">exam mode</Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          {exam ? (
            <span className="flex items-center gap-1 text-primary">
              <ClipboardList className="size-4" /> {answeredCount}/{quiz.questions.length}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1 text-accent">
                <Flame className="size-4" /> {streak}
              </span>
              <span className="flex items-center gap-1 text-primary">
                <Trophy className="size-4" /> {score}
              </span>
            </>
          )}
          <span
            className={cn(
              "flex items-center gap-1 font-display font-bold",
              revealed && !exam
                ? "text-accent"
                : low
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {revealed && !exam ? <Pause className="size-4" /> : <Clock className="size-4" />}{" "}
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>

      <Progress value={((index + (revealed || exam ? 1 : 0)) / quiz.questions.length) * 100} />

      {exam && (
        <div className="flex flex-wrap gap-1.5">
          {quiz.questions.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to question ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onJump(i)}
              className={cn(
                "size-8 rounded-lg border font-display text-xs font-bold transition-colors",
                i === index
                  ? "border-primary bg-primary text-primary-foreground"
                  : answers[i] !== null
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="surface-card space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full bg-secondary text-secondary-foreground">
            {q.topic}
          </Badge>
          <Badge variant="outline" className="rounded-full capitalize">
            {q.difficulty}
          </Badge>
        </div>
        <h2 className="font-display text-xl font-bold leading-snug sm:text-2xl">{q.question}</h2>

        <div className="space-y-2">
          {q.options.map((option, i) => {
            const isCorrect = i === q.correctIndex;
            const isPicked = i === answer;
            return (
              <button
                key={i}
                disabled={revealed}
                onClick={() => onPick(i)}
                className={cn(
                  "w-full rounded-2xl border px-3.5 py-3 text-left text-sm transition-colors sm:px-4 sm:text-base",
                  !revealed &&
                    (exam && isPicked
                      ? "border-primary/60 bg-primary/15"
                      : "border-border bg-secondary/40 hover:bg-secondary"),
                  revealed && isCorrect && "border-success/60 bg-success/15 text-success",
                  revealed &&
                    isPicked &&
                    !isCorrect &&
                    "border-destructive/60 bg-destructive/15 text-destructive",
                  revealed && !isCorrect && !isPicked && "border-border opacity-50",
                )}
              >
                <span className="mr-2 font-display font-bold">
                  {String.fromCharCode(65 + i)}.
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {revealed && (
          <>
            <div
              className={cn(
                "rounded-2xl border p-4",
                correct ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10",
              )}
            >
              <p className="font-display font-bold">
                {correct ? "W answer 🔥" : "Nope — here's the tea"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{q.explanation}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Topic: <span className="text-foreground">{q.topic}</span> · Level:{" "}
                <span className="capitalize text-foreground">{q.difficulty}</span>
              </p>
            </div>
            <FactCheckPanel
              question={q}
              cached={factCheck}
              onSave={(c) => onFactCheck(index, c)}
            />
          </>
        )}

        {exam && (
          <p className="text-xs text-muted-foreground">
            No spoilers in exam mode — answers, fact-checks and analysis drop after you submit.
          </p>
        )}
      </div>

      {exam ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              className="h-12 rounded-2xl font-bold sm:h-14"
              disabled={index === 0}
              onClick={() => onJump(index - 1)}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              className="h-12 rounded-2xl font-bold sm:h-14"
              onClick={onSkip}
            >
              <SkipForward className="mr-1.5 size-4 sm:mr-2 sm:size-5" /> Skip
            </Button>
            <Button
              className="h-12 rounded-2xl font-bold sm:h-14"
              disabled={last}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
          <Button
            size="lg"
            variant={answeredCount === quiz.questions.length || last ? "default" : "outline"}
            className="h-12 w-full rounded-2xl text-sm font-bold sm:h-14 sm:text-base"
            onClick={onSubmit}
          >
            Submit exam ({answeredCount}/{quiz.questions.length} answered)
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base font-bold"
          disabled={!revealed}
          onClick={onNext}
        >
          {last ? "See my score" : "Next question"}
        </Button>
      )}
    </section>
  );
}


function FactCheckPanel({
  question,
  cached,
  onSave,
}: {
  question: QuizQuestion;
  cached: FactCheck | null;
  onSave: (check: FactCheck) => void;
}) {
  const check = useServerFn(factCheckQuestion);
  const [state, setState] = useState<FactCheck | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cached) {
      setState(cached);
      setLoading(false);
      return;
    }
    let alive = true;
    setState(null);
    setLoading(true);
    setFailed(false);
    check({
      data: {
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
      },
    })
      .then((r) => {
        if (!alive) return;
        setState(r);
        onSave(r);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, check]);

  if (loading)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> fact-checking this one…
      </p>
    );
  if (failed || !state) return null;

  const clean = state.verdict === "solid";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        clean ? "border-border bg-secondary/30" : "border-accent/50 bg-accent/10",
      )}
    >
      <p className="flex items-center gap-2 font-display text-sm font-bold">
        <ShieldCheck className={cn("size-4", clean ? "text-success" : "text-accent")} />
        {clean
          ? "Fact-check: checks out"
          : state.verdict === "wrong"
            ? "Fact-check: this answer looks off"
            : "Fact-check: kinda ambiguous"}
      </p>
      <FactCheckContent state={state} />
    </div>
  );
}

function FactCheckContent({ state }: { state: FactCheck }) {
  const clean = state.verdict === "solid";
  return (
    <>
      {state.note && <p className="mt-1 text-sm text-muted-foreground">{state.note}</p>}

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span
            className={cn(
              "font-display font-bold",
              state.confidence >= 80
                ? "text-success"
                : state.confidence >= 50
                  ? "text-accent"
                  : "text-destructive",
            )}
          >
            {Math.round(state.confidence)}%
          </span>
        </div>
        <Progress value={state.confidence} className="h-1.5" />
        {state.confidenceReason && (
          <p className="text-xs text-muted-foreground">{state.confidenceReason}</p>
        )}
      </div>

      {state.evidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Why the answer holds up
          </p>
          <ul className="mt-1 space-y-1">
            {state.evidence.map((e, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="shrink-0 text-success">✓</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.rejections.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Why the other options flopped
          </p>
          <ul className="mt-1 space-y-1">
            {state.rejections.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="shrink-0 text-destructive">✕</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!clean && state.suggestedQuestion && (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Better question: </span>
          {state.suggestedQuestion}
        </p>
      )}
      {!clean && state.suggestedAnswer && (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Correct answer: </span>
          <span className="text-success">{state.suggestedAnswer}</span>
        </p>
      )}
      {state.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LinkIcon className="size-3" /> {s.title}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function Results({
  quiz,
  mode,
  answers,
  score,
  bestStreak,
  factChecks,
  onFactCheck,
  onReset,
  onRegenerate,
  regenerating,
  canRegenerate,

}: {
  quiz: Quiz;
  mode: Mode;
  answers: (number | null)[];
  score: number;
  bestStreak: number;
  factChecks: Record<number, FactCheck>;
  onFactCheck: (index: number, check: FactCheck) => void;
  onReset: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
  canRegenerate: boolean;

}) {
  const total = quiz.questions.length;
  const pct = Math.round((score / total) * 100);
  const verdict =
    pct >= 85 ? "certified genius" : pct >= 60 ? "solid, keep cooking" : "we need a rerun";
  const exam = mode === "exam";
  const skipped = answers.filter((a) => a === null).length;
  const wrong = total - score - skipped;

  const checkFn = useServerFn(factCheckQuestion);
  const [checking, setChecking] = useState(exam);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!exam || startedRef.current) return;
    startedRef.current = true;
    let alive = true;
    (async () => {
      const queue = quiz.questions.map((q, i) => ({ q, i })).filter(({ i }) => !factChecks[i]);
      let cursor = 0;
      const worker = async () => {
        while (alive) {
          const job = queue[cursor++];
          if (!job) return;
          try {
            const r = await checkFn({
              data: {
                question: job.q.question,
                options: job.q.options,
                correctIndex: job.q.correctIndex,
              },
            });
            if (!alive) return;
            onFactCheck(job.i, r);
          } catch {
            /* skip this one */
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
      if (alive) setChecking(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]);

  const topics = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    quiz.questions.forEach((q, i) => {
      const row = map.get(q.topic) ?? { correct: 0, total: 0 };
      row.total += 1;
      if (answers[i] === q.correctIndex) row.correct += 1;
      map.set(q.topic, row);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [quiz, answers]);

  const checkedList = Object.values(factChecks);
  const avgConfidence = checkedList.length
    ? Math.round(checkedList.reduce((s, c) => s + c.confidence, 0) / checkedList.length)
    : 0;
  const flagged = checkedList.filter((c) => c.verdict !== "solid").length;

  return (
    <section className="space-y-6">
      <div className="surface-card glow-pink p-6 text-center sm:p-8">
        <Brain className="mx-auto mb-3 size-8 text-accent" />
        {exam && (
          <Badge className="mb-2 rounded-full bg-accent text-accent-foreground">
            exam report
          </Badge>
        )}
        <p className="font-display text-5xl font-bold text-hype sm:text-6xl">{pct}%</p>
        <p className="mt-2 font-display text-lg font-bold sm:text-xl">{verdict}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {score}/{total} correct · {wrong} wrong · {skipped} skipped
          {!exam && ` · best streak ${bestStreak} 🔥`}
        </p>
      </div>

      <div className="surface-card space-y-5 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <ClipboardList className="size-5 text-primary" /> Analysis
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatBox label="Correct" value={`${score}`} tone="success" />
          <StatBox label="Wrong" value={`${wrong}`} tone="destructive" />
          <StatBox label="Skipped" value={`${skipped}`} tone="muted" />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Topic breakdown
          </p>
          {topics.map(([topic, row]) => (
            <div key={topic} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{topic}</span>
                <span className="font-display font-bold text-primary">
                  {row.correct}/{row.total}
                </span>
              </div>
              <Progress value={(row.correct / row.total) * 100} className="h-1.5" />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {checking
            ? "Fact-checking every question…"
            : checkedList.length
              ? `Avg source confidence ${avgConfidence}% · ${flagged} question${flagged === 1 ? "" : "s"} flagged`
              : "No fact-checks saved for this run."}
        </p>
      </div>

      {exam && checking && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Running fact-checks on all{" "}
          {total} questions…
        </p>
      )}


      <div className="space-y-3">
        {quiz.questions.map((q, i) => {
          const picked = answers[i] ?? null;
          const ok = picked === q.correctIndex;
          return (
            <div key={i} className="surface-card space-y-2 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-display text-sm font-bold sm:text-base">
                  {i + 1}. {q.question}
                </p>
                <Badge
                  className={cn(
                    "shrink-0 rounded-full",
                    ok
                      ? "bg-success text-success-foreground"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {ok ? "correct" : picked === null ? "skipped" : "wrong"}
                </Badge>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Answer: </span>
                {q.options[q.correctIndex]}
              </p>
              {picked !== null && !ok && (
                <p className="text-sm text-destructive">You picked: {q.options[picked]}</p>
              )}
              <p className="text-sm text-muted-foreground">{q.explanation}</p>
              <p className="text-xs text-muted-foreground">
                {q.topic} · <span className="capitalize">{q.difficulty}</span>
              </p>
              {factChecks[i] && (
                <div
                  className={cn(
                    "mt-2 rounded-xl border p-4",
                    factChecks[i]!.verdict === "solid"
                      ? "border-border bg-secondary/30"
                      : "border-accent/50 bg-accent/10",
                  )}
                >
                  <p className="flex items-center gap-2 font-display text-sm font-bold">
                    <ShieldCheck
                      className={cn(
                        "size-4",
                        factChecks[i]!.verdict === "solid" ? "text-success" : "text-accent",
                      )}
                    />
                    {factChecks[i]!.verdict === "solid"
                      ? "Fact-check: checks out"
                      : factChecks[i]!.verdict === "wrong"
                        ? "Fact-check: this answer looks off"
                        : "Fact-check: kinda ambiguous"}
                  </p>
                  <FactCheckContent state={factChecks[i]!} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-full rounded-2xl text-base font-bold"
          onClick={onReset}
          disabled={regenerating}
        >
          <RotateCcw className="mr-2 size-5" /> New PDF
        </Button>
        {canRegenerate && (
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-bold"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" /> Cooking new set…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-5" /> New questions, same PDF
              </>
            )}
          </Button>
        )}
      </div>

      <FeedbackForm />
    </section>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "destructive" | "muted";
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-4">
      <p
        className={cn(
          "font-display text-2xl font-bold",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
