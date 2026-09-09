import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const Input = z.object({
  question: z.string().trim().min(3).max(4000),
  answer: z.string().trim().min(1).max(20000),
  maxMarks: z.coerce.number().min(1).max(200),
  wordLimit: z.coerce.number().min(0).max(5000).default(0),
  timeTakenSeconds: z.coerce.number().min(0).max(100000).optional(),
  timeLimitSeconds: z.coerce.number().min(0).max(100000).optional(),
  mode: z.enum(["check", "exam"]).default("check"),
});

export type AnswerCheckInput = z.infer<typeof Input>;

const ResultSchema = z.object({
  marks: z.coerce.number().min(0).default(0),
  grade: z.string().default(""),
  verdict: z.string().default(""),
  breakdown: z
    .array(
      z.object({
        criterion: z.string().default(""),
        score: z.coerce.number().default(0),
        outOf: z.coerce.number().default(0),
        comment: z.string().default(""),
      }),
    )
    .default([]),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
  modelAnswer: z.string().default(""),
});

export type AnswerCheckResult = z.infer<typeof ResultSchema> & {
  wordCount: number;
  wordLimit: number;
  overLimit: boolean;
  timeTakenSeconds?: number;
};

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const checkDescriptiveAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<AnswerCheckResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const wordCount = countWords(data.answer);
    const overLimit = data.wordLimit > 0 && wordCount > data.wordLimit;

    const prompt = `You are a strict but fair exam evaluator. Grade this descriptive answer.

QUESTION:
${data.question}

MAX MARKS: ${data.maxMarks}
WORD LIMIT: ${data.wordLimit > 0 ? data.wordLimit : "none"}
WORDS WRITTEN: ${wordCount}${overLimit ? " (OVER the limit — penalise slightly)" : ""}
${data.timeTakenSeconds ? `TIME TAKEN: ${Math.round(data.timeTakenSeconds / 60)} min` : ""}

STUDENT ANSWER:
${data.answer}

Grade on content accuracy, coverage/depth, structure & presentation, and language. Award marks out of ${data.maxMarks}, allowing halves.

Output ONLY raw JSON, no code fences:
{"marks":0,"grade":"A/B/C/D/E","verdict":"1-2 sentence overall judgement","breakdown":[{"criterion":"Content accuracy","score":0,"outOf":0,"comment":"<=18 words"},{"criterion":"Coverage & depth","score":0,"outOf":0,"comment":""},{"criterion":"Structure","score":0,"outOf":0,"comment":""},{"criterion":"Language","score":0,"outOf":0,"comment":""}],"strengths":["<=15 words each"],"improvements":["actionable, <=18 words each"],"missingPoints":["key points the answer skipped"],"modelAnswer":"a concise model answer that would score full marks, respecting the word limit"}

The breakdown outOf values MUST sum to exactly ${data.maxMarks}, and marks MUST equal the sum of the scores.`;

    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
      maxOutputTokens: 4000,
      temperature: 0.2,
    });

    const raw = (await result.text)
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not read the evaluation. Try again.");
      parsed = JSON.parse(match[0]);
    }

    const checked = ResultSchema.parse(parsed);

    return {
      ...checked,
      marks: Math.max(0, Math.min(data.maxMarks, checked.marks)),
      wordCount,
      wordLimit: data.wordLimit,
      overLimit,
      timeTakenSeconds: data.timeTakenSeconds,
    };
  });
