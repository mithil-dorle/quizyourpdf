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

export const generateStudyPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const planDays = Math.min(data.days, 30);
    const source = data.syllabus.slice(0, 40000);

    const prompt = `You are an expert exam coach. Build a day-by-day study schedule.

Exam: ${data.exam}
Days until exam: ${data.days} (schedule the first ${planDays} days in detail)
Hours available per day: ${data.hoursPerDay}
Student level: ${data.level}

Reply with ONLY raw JSON (no markdown fences) in exactly this shape:
{"title":"short plan title","strategy":["3-5 short punchy tips"],"days":[{"day":1,"focus":"short theme","slots":[{"slot":"Slot 1 · 60 min","items":[{"topic":"topic name","priority":"high|medium|low","minutes":60,"note":"one short line on what to do"}]}]}]}

Rules:
- Exactly ${planDays} day objects, day numbers 1..${planDays}.
- Total minutes per day must be about ${data.hoursPerDay * 60} minutes, split into ${Math.max(1, Math.round(data.hoursPerDay))} slots.
- priority: high = high-yield/crucial, medium = normal, low = quick read.
- Use spaced repetition: revisit earlier topics later, and reserve the last 15% of days for revision + mock practice.
- Only use topics from the syllabus below.
- Keep notes under 12 words.

SYLLABUS:
"""
${source}
"""`;

    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
      maxOutputTokens: 32000,
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


    const plan = PlanSchema.parse(parsed);
    if (!plan.days.length) throw new Error("The AI couldn't shape a plan. Try again.");
    return plan;
  });

// Model output can get cut off mid-object when it hits the token cap.
// Walk back to the last valid prefix and close the open brackets/strings.
function repairTruncatedJson(text: string): unknown {
  if (!text) return null;
  for (let end = text.length; end > 1; end--) {
    const slice = text.slice(0, end);
    const closed = closeOpenStructures(slice);
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
