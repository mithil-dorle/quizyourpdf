import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const TopicSchema = z.object({
  topic: z.string(),
  priority: z.enum(["high", "medium", "low"]).catch("medium"),
  minutes: z.number().catch(60),
  note: z.string().default(""),
});

const SlotSchema = z.object({
  slot: z.string(),
  items: z.array(TopicSchema).default([]),
});

const DaySchema = z.object({
  day: z.number(),
  focus: z.string().default(""),
  slots: z.array(SlotSchema).default([]),
});

const PlanSchema = z.object({
  title: z.string().default("Your Study Plan"),
  strategy: z.array(z.string()).default([]),
  days: z.array(DaySchema).default([]),
});

export type StudyTopic = z.infer<typeof TopicSchema>;
export type StudySlot = z.infer<typeof SlotSchema>;
export type StudyDay = z.infer<typeof DaySchema>;
export type StudyPlan = z.infer<typeof PlanSchema>;

const Input = z.object({
  exam: z.string().min(1).max(120),
  days: z.number().min(1),
  hoursPerDay: z.number().min(1).max(18),
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

type CompactItem = [string, string, number, string?];
type CompactSlot = { n?: string; i?: CompactItem[] };
type CompactDay = { d?: number; f?: string; s?: CompactSlot[] };
type CompactPlan = { title?: string; strategy?: string[]; days?: CompactDay[] };

// The model replies in a compact shape (short keys, item tuples) so it emits
// far fewer tokens — expand it back into the full plan shape here.
function expand(raw: CompactPlan): unknown {
  return {
    title: raw.title,
    strategy: raw.strategy,
    days: (raw.days ?? []).map((d, di) => ({
      day: d.d ?? di + 1,
      focus: d.f ?? "",
      slots: (d.s ?? []).map((s, si) => ({
        slot: s.n ?? `Slot ${si + 1}`,
        items: (s.i ?? []).map((it) => ({
          topic: it[0] ?? "",
          priority: PRIORITY[String(it[1] ?? "m").toLowerCase()] ?? "medium",
          minutes: Number(it[2]) || 45,
          note: it[3] ?? "",
        })),
      })),
    })),
  };
}

export const generateStudyPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const planDays = Math.min(data.days, 30);
    const slots = Math.min(4, Math.max(1, Math.round(data.hoursPerDay / 1.5)));
    const source = data.syllabus.slice(0, 12000);

    const prompt = `You are an expert exam coach. Build a day-by-day study schedule.

Exam: ${data.exam}
Days until exam: ${data.days} (schedule the first ${planDays} days)
Hours available per day: ${data.hoursPerDay}
Student level: ${data.level}

Reply with ONLY raw minified JSON (no markdown, no spaces) in exactly this shape:
{"title":"short title","strategy":["3 short tips"],"days":[{"d":1,"f":"theme","s":[{"n":"Slot 1","i":[["topic","h",60,"what to do"]]}]}]}

Item tuple = [topic, priority, minutes, note]. priority is "h" (high-yield), "m" or "l".

Rules:
- Exactly ${planDays} day objects, d = 1..${planDays}.
- ${slots} slots per day, total ${data.hoursPerDay * 60} minutes per day, 1-2 items per slot.
- Spaced repetition: revisit earlier topics later; last 15% of days = revision + mocks.
- Only topics from the syllabus. Notes under 8 words. No repeated filler text.

SYLLABUS:
"""
${source}
"""`;

    const result = streamText({
      model: gateway("google/gemini-3.7-flash"),
      prompt,
      maxOutputTokens: 16000,
      providerOptions: { lovable: { service_tier: "priority" } },
    });
    const raw = await result.text;
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    const candidate = cleaned.startsWith("{") ? cleaned : (cleaned.match(/\{[\s\S]*/)?.[0] ?? "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      const repaired = repairTruncatedJson(candidate);
      if (!repaired) throw new Error("The AI couldn't shape a plan from this syllabus. Try again.");
      parsed = repaired;
    }

    const plan = PlanSchema.parse(expand(parsed as CompactPlan));
    if (!plan.days.length) throw new Error("The AI couldn't shape a plan. Try again.");
    return plan;
  });

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
