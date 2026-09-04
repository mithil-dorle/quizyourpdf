import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const TopicSchema = z.object({
  topic: z.string(),
  priority: z.enum(["high", "medium", "low"]).catch("medium"),
  minutes: z.number().catch(60),
  note: z.string().default(""),
});

const WeekDaySchema = z.object({
  name: z.string(),
  focus: z.string().default(""),
  items: z.array(TopicSchema).default([]),
});

const WeekSchema = z.object({
  week: z.number(),
  theme: z.string().default(""),
  topics: z.array(TopicSchema).default([]),
  days: z.array(WeekDaySchema).default([]),
  milestone: z.string().default(""),
});

const PlanSchema = z.object({
  title: z.string().default("Your Study Plan"),
  strategy: z.array(z.string()).default([]),
  weeks: z.array(WeekSchema).default([]),
});

export type StudyTopic = z.infer<typeof TopicSchema>;
export type StudyWeekDay = z.infer<typeof WeekDaySchema>;
export type StudyWeek = z.infer<typeof WeekSchema>;
export type StudyPlan = z.infer<typeof PlanSchema>;

const Input = z.object({
  exam: z.string().min(1).max(120),
  weeks: z.number().min(1),
  hoursPerDay: z.number().min(1).max(18),
  studyDaysPerWeek: z.number().min(1).max(7).default(6),
  level: z.string(),
  syllabus: z.string().min(20),
});

const PRIORITY: Record<string, "high" | "medium" | "low"> = {
  h: "high",
  m: "medium",
  l: "low",
  high: "high",
  medium: "medium",
  low: "low",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CompactItem = [string, string, number, string?];
type CompactDay = { n?: string; f?: string; i?: CompactItem[] };
type CompactWeek = { w?: number; t?: string; tp?: CompactItem[]; d?: CompactDay[]; ms?: string };
type CompactPlan = {
  title?: string | undefined;
  strategy?: string[] | undefined;
  weeks?: CompactWeek[] | undefined;
};

function item(it: CompactItem) {
  return {
    topic: it[0] ?? "",
    priority: PRIORITY[String(it[1] ?? "m").toLowerCase()] ?? "medium",
    minutes: Number(it[2]) || 45,
    note: it[3] ?? "",
  };
}

// The model replies in a compact shape (short keys, item tuples) so it emits
// far fewer tokens — expand it back into the full plan shape here.
function expand(raw: CompactPlan): unknown {
  return {
    title: raw.title,
    strategy: raw.strategy,
    weeks: (raw.weeks ?? []).map((w, wi) => ({
      week: w.w ?? wi + 1,
      theme: w.t ?? "",
      milestone: w.ms ?? "",
      topics: (w.tp ?? []).map(item),
      days: (w.d ?? []).map((d, di) => ({
        name: d.n ?? WEEKDAYS[di % 7]!,
        focus: d.f ?? "",
        items: (d.i ?? []).map(item),
      })),
    })),
  };
}

const CHUNK = 2;

export const generateStudyPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const planWeeks = Math.min(data.weeks, 16);
    const studyDays = data.studyDaysPerWeek;
    const source = data.syllabus.slice(0, 12000);

    const ranges: Array<[number, number]> = [];
    for (let s = 1; s <= planWeeks; s += CHUNK) ranges.push([s, Math.min(planWeeks, s + CHUNK - 1)]);

    // Week chunks are generated in parallel, so a 12-week plan takes about
    // as long as a 2-week one.
    async function chunk(from: number, to: number, withMeta: boolean): Promise<CompactPlan> {
      const phase =
        from > planWeeks * 0.8
          ? "final stretch: full revision, mock papers and weak-spot repair"
          : from === 1
            ? "foundations first, highest-yield topics early"
            : "build on earlier weeks and revisit them with spaced repetition";

      const prompt = `You are an expert exam coach building part of a WEEK-BY-WEEK study schedule.

Exam: ${data.exam}
Weeks until exam: ${data.weeks} (${data.weeks * 7} days). Full plan covers weeks 1-${planWeeks}.
You write ONLY weeks ${from} to ${to}. Phase: ${phase}.
Study days per week: ${studyDays} · Hours per study day: ${data.hoursPerDay}
Student level: ${data.level}

Reply with ONLY raw minified JSON (no markdown, no spaces):
{${withMeta ? '"title":"short title","strategy":["3 short punchy tips"],' : ""}"weeks":[{"w":${from},"t":"week theme","ms":"end-of-week milestone","tp":[["topic to cover this week","h",180,"why it matters"]],"d":[{"n":"Mon","f":"day focus","i":[["topic","h",60,"what to do"]]}]}]}

Item tuple = [topic, priority, minutes, note]. priority is "h" (high-yield), "m" or "l".
${withMeta ? `The title and strategy describe the WHOLE ${planWeeks}-week plan for ${data.exam}, never just these weeks.` : ""}

Rules:
- Exactly ${to - from + 1} week objects, w = ${from}..${to}.
- "tp" = 4-7 topics to cover that week, minutes = total time for that topic across the week.
- "d" = exactly ${studyDays} day objects using ${WEEKDAYS.slice(0, studyDays).join(", ")}, each totalling ${data.hoursPerDay * 60} minutes with 2-3 items.
- Day items must come from that week's "tp" topics (plus revision of earlier weeks).
- Only topics from the syllabus. Notes under 8 words. No filler.

SYLLABUS:
"""
${source}
"""`;

      const result = streamText({
        model: gateway("google/gemini-3.7-flash"),
        prompt,
        maxOutputTokens: 8000,
        providerOptions: { lovable: { service_tier: "priority" } },
      });
      return parsePlanJson(await result.text);
    }

    const parts = await Promise.all(ranges.map(([f, t], i) => chunk(f, t, i === 0)));

    const merged: CompactPlan = {
      title: parts[0]?.title,
      strategy: parts[0]?.strategy,
      weeks: parts
        .flatMap((p) => p.weeks ?? [])
        .sort((a, b) => (a.w ?? 0) - (b.w ?? 0))
        .slice(0, planWeeks),
    };

    const plan = PlanSchema.parse(expand(merged));
    if (!plan.weeks.length) throw new Error("The AI couldn't shape a plan. Try again.");
    return plan;
  });

function parsePlanJson(raw: string): CompactPlan {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const candidate = cleaned.startsWith("{") ? cleaned : (cleaned.match(/\{[\s\S]*/)?.[0] ?? "");
  try {
    return JSON.parse(candidate) as CompactPlan;
  } catch {
    const repaired = repairTruncatedJson(candidate);
    if (!repaired) throw new Error("The AI couldn't shape a plan from this syllabus. Try again.");
    return repaired as CompactPlan;
  }
}

// Model output can get cut off mid-object when it hits the token cap.
// Only retry at plausible cut points (after a closing bracket) so repair stays fast.
function repairTruncatedJson(text: string): unknown {
  if (!text) return null;
  let tries = 0;
  for (let end = text.length; end > 1 && tries < 400; end--) {
    const ch = text[end - 1];
    if (ch !== "}" && ch !== "]") continue;
    tries++;
    const closed = closeOpenStructures(text.slice(0, end));
    if (!closed) continue;
    try {
      return JSON.parse(closed);
    } catch {
      // keep trimming
    }
  }
  return null;
}

function closeOpenStructures(slice: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of slice) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString || escaped) return null;
  let out = slice.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}
