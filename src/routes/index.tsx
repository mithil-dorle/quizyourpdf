import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Clock,
  FileUp,
  Flame,
  Link as LinkIcon,
  Loader2,
  Pause,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuizLab — Turn any PDF into a quiz game" },
      {
        name: "description",
        content:
          "Upload your notes, get an instant AI-built quiz with timers, difficulty levels and per-question feedback. Studying, but make it a game.",
      },
      { property: "og:title", content: "QuizLab — Turn any PDF into a quiz game" },
      {
        property: "og:description",
        content:
          "Upload a PDF, pick your settings, and battle an AI-generated quiz with live scoring and instant feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("PDFs only, bestie.");
      return;
    }
    setBusy("Reading your PDF…");
    try {
      const text = await extractPdfText(file);
      if (text.length < 200) {
        setError("That PDF looks like scanned images — no text to read.");
        setBusy(null);
        return;
      }
      setPdfText(text);
      setFileName(file.name);
    } catch {
      setError("Couldn't read that file. Try another PDF.");
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">QuizLab</span>
        </div>
        <Badge variant="outline" className="rounded-full border-accent/40 text-accent">
          study, but a game
        </Badge>
      </header>

      {stage === "upload" && (
        <section className="space-y-8">
          <div className="space-y-3 text-center">
            <h1 className="font-display text-5xl font-bold leading-[1.05] sm:text-6xl">
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
            className="surface-card glow-lime cursor-pointer p-10 text-center transition-transform hover:-translate-y-0.5"
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
              {fileName ? "locked in — tweak the settings below" : "or tap to browse (full PDF, no page limit)"}
            </p>
          </div>

          <div className="surface-card space-y-7 p-6">
            <h2 className="font-display text-lg font-bold">Quiz settings</h2>

            <SettingRow icon={<Target className="size-4" />} label="Questions" value={`${count}`}>
              <Slider
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
                      "rounded-2xl border px-3 py-3 text-left transition-colors",
                      difficulty === d.id
                        ? "border-primary/60 bg-primary/15"
                        : "border-border bg-secondary/40 hover:bg-secondary",
                    )}
                  >
                    <span className="block font-display font-bold">{d.label}</span>
                    <span className="text-xs text-muted-foreground">{d.sub}</span>
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
                    <span className="text-xs text-muted-foreground">{m.sub}</span>
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
        />
      )}

    </main>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            Q{index + 1} / {quiz.questions.length}
          </Badge>
          {exam && (
            <Badge className="rounded-full bg-accent text-accent-foreground">exam mode</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
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

      <div className="surface-card space-y-5 p-6">
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full bg-secondary text-secondary-foreground">
            {q.topic}
          </Badge>
          <Badge variant="outline" className="rounded-full capitalize">
            {q.difficulty}
          </Badge>
        </div>
        <h2 className="font-display text-2xl font-bold leading-snug">{q.question}</h2>

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
                  "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
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
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="h-14 flex-1 rounded-2xl font-bold"
              disabled={index === 0}
              onClick={() => onJump(index - 1)}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              className="h-14 flex-1 rounded-2xl font-bold"
              onClick={onSkip}
            >
              <SkipForward className="mr-2 size-5" /> Skip
            </Button>
            <Button
              className="h-14 flex-1 rounded-2xl font-bold"
              disabled={last}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
          <Button
            size="lg"
            variant={answeredCount === quiz.questions.length || last ? "default" : "outline"}
            className="h-14 w-full rounded-2xl text-base font-bold"
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
  answers,
  score,
  bestStreak,
  factChecks,
  onReset,
}: {
  quiz: Quiz;
  answers: (number | null)[];
  score: number;
  bestStreak: number;
  factChecks: Record<number, FactCheck>;
  onReset: () => void;
}) {
  const total = quiz.questions.length;
  const pct = Math.round((score / total) * 100);
  const verdict =
    pct >= 85 ? "certified genius" : pct >= 60 ? "solid, keep cooking" : "we need a rerun";

  return (
    <section className="space-y-6">
      <div className="surface-card glow-pink p-8 text-center">
        <Brain className="mx-auto mb-3 size-8 text-accent" />
        <p className="font-display text-6xl font-bold text-hype">{pct}%</p>
        <p className="mt-2 font-display text-xl font-bold">{verdict}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {score}/{total} correct · best streak {bestStreak} 🔥
        </p>
      </div>

      <div className="space-y-3">
        {quiz.questions.map((q, i) => {
          const picked = answers[i] ?? null;
          const ok = picked === q.correctIndex;
          return (
            <div key={i} className="surface-card space-y-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display font-bold">
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

      <Button
        size="lg"
        variant="secondary"
        className="h-14 w-full rounded-2xl text-base font-bold"
        onClick={onReset}
      >
        <RotateCcw className="mr-2 size-5" /> New PDF
      </Button>
    </section>
  );
}
