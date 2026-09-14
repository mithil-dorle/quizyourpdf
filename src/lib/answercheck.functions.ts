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
  weights: z
    .object({
      accuracy: z.coerce.number().int().min(0).max(100),
      keyword: z.coerce.number().int().min(0).max(100),
      depth: z.coerce.number().int().min(0).max(100),
      structure: z.coerce.number().int().min(0).max(100),
      conciseness: z.coerce.number().int().min(0).max(100),
    })
    .refine((weights) => Object.values(weights).reduce((sum, value) => sum + value, 0) === 100, {
      message: "Evaluation weights must total 100%.",
    }),
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

const PillarSchema = z.object({
  factualAccuracy: z.object({ scorePercent: z.coerce.number().min(0).max(100), comment: z.string() }),
  conceptKeywordMatch: z.object({ scorePercent: z.coerce.number().min(0).max(100), comment: z.string() }),
  analyticalDepth: z.object({ scorePercent: z.coerce.number().min(0).max(100), comment: z.string() }),
  structureFlow: z.object({ scorePercent: z.coerce.number().min(0).max(100), comment: z.string() }),
  conciseness: z.object({ scorePercent: z.coerce.number().min(0).max(100), comment: z.string() }),
  grade: z.string().default(""),
  verdict: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
  modelAnswer: z.string().default(""),
});

export type AnswerCheckResult = z.infer<typeof ResultSchema> & {
  wordCount: number;
  wordLimit: number;
  overLimit: boolean;
  timeTakenSeconds?: number | undefined;
};

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
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

    const prompt = `SYSTEM ROLE:
You are an expert academic evaluator for highly competitive exams. Blindly and rigorously grade the student's descriptive answer against the question and a standardized model rubric. Derive the expected model rubric from the question before evaluating. Do not reward confident but unsupported claims.

QUESTION:
${data.question}

MAX MARKS: ${data.maxMarks}
WORD LIMIT: ${data.wordLimit > 0 ? data.wordLimit : "none"}
WORDS WRITTEN: ${wordCount}${overLimit ? " (OVER the limit — penalise slightly)" : ""}
${data.timeTakenSeconds ? `TIME TAKEN: ${Math.round(data.timeTakenSeconds / 60)} min` : ""}

SCORING WEIGHTS (must control the score):
- Factual Accuracy: ${data.weights.accuracy}%
- Concept & Keyword Match: ${data.weights.keyword}%
- Analytical Depth: ${data.weights.depth}%
- Structure & Flow: ${data.weights.structure}%
- Conciseness: ${data.weights.conciseness}%

STUDENT ANSWER:
${data.answer}

EVALUATION LOGIC — assess each pillar independently from 0 to 100:
1. Factual Accuracy: Does the answer directly address the core premise? Identify incorrect statements. Penalize made-up data, hallucinations, and contradictory claims heavily.
2. Concept & Keyword Match: Compare with the expected model rubric. Check whether non-negotiable technical terms, legal acts, historical dates, formulas, or scientific principles are present and correctly used.
3. Analytical Depth: Reward how/why explanations, valid examples, case studies, evidence, data, causal links, and justified conclusions. Surface-level definitions score lower.
4. Structure & Flow: Check logical progression, introduction, body points or paragraphs, conclusion, and transitions. Do not penalize minor grammar unless it obscures meaning; penalize heavy grammatical errors here only.
5. Conciseness: Reward direct relevant writing. Deduct for repetition and filler used to inflate word count. Consider the stated word limit without double-penalizing content omissions.

The server will apply the supplied weights to your five 0–100 pillar scores and calculate marks out of ${data.maxMarks}. Your comments must explain the evidence for each score, including specific errors or missing essentials where relevant.

Output ONLY raw JSON, no code fences:
{"factualAccuracy":{"scorePercent":0,"comment":"specific evidence, <=30 words"},"conceptKeywordMatch":{"scorePercent":0,"comment":""},"analyticalDepth":{"scorePercent":0,"comment":""},"structureFlow":{"scorePercent":0,"comment":""},"conciseness":{"scorePercent":0,"comment":""},"grade":"A/B/C/D/E","verdict":"1-2 sentence rigorous overall judgement","strengths":["<=15 words each"],"improvements":["actionable, <=18 words each"],"missingPoints":["key rubric points the answer skipped"],"modelAnswer":"a concise full-marks answer respecting the word limit"}`;

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

    const evaluated = PillarSchema.parse(parsed);
    const pillars = [
      { criterion: "Factual Accuracy", weight: data.weights.accuracy, value: evaluated.factualAccuracy },
      { criterion: "Concept & Keyword Match", weight: data.weights.keyword, value: evaluated.conceptKeywordMatch },
      { criterion: "Analytical Depth", weight: data.weights.depth, value: evaluated.analyticalDepth },
      { criterion: "Structure & Flow", weight: data.weights.structure, value: evaluated.structureFlow },
      { criterion: "Conciseness", weight: data.weights.conciseness, value: evaluated.conciseness },
    ];
    const breakdown = pillars.map(({ criterion, weight, value }) => ({
      criterion,
      outOf: Number(((data.maxMarks * weight) / 100).toFixed(2)),
      score: Number(((data.maxMarks * weight * value.scorePercent) / 10000).toFixed(2)),
      comment: value.comment,
    }));
    const rawMarks = breakdown.reduce((sum, item) => sum + item.score, 0);
    const marks = Math.max(0, Math.min(data.maxMarks, roundToHalf(rawMarks)));

    return {
      marks,
      grade: evaluated.grade,
      verdict: evaluated.verdict,
      breakdown,
      strengths: evaluated.strengths,
      improvements: evaluated.improvements,
      missingPoints: evaluated.missingPoints,
      modelAnswer: evaluated.modelAnswer,
      wordCount,
      wordLimit: data.wordLimit,
      overLimit,
      timeTakenSeconds: data.timeTakenSeconds,
    };
  });
