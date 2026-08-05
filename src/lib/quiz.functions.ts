import { createServerFn } from "@tanstack/react-start";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanation: z.string(),
  difficulty: z.string(),
  topic: z.string(),
});

const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(QuestionSchema),
});

export type QuizQuestion = z.infer<typeof QuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;

const Input = z.object({
  text: z.string().min(50),
  count: z.number(),
  difficulty: z.string(),
});

export const generateQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const source = data.text.slice(0, 60000);
    const prompt = `You are a study-quiz generator. Read the document below and write exactly ${data.count} multiple-choice questions at "${data.difficulty}" difficulty.

Reply with ONLY raw JSON (no markdown fences, no commentary) in exactly this shape:
{"title": "short catchy quiz title", "questions": [{"question": "...", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "...", "difficulty": "easy|medium|hard", "topic": "1-4 words"}]}

Rules:
- Each question has exactly 4 options, exactly one correct.
- correctIndex is the 0-based index of the correct option.
- explanation: 1-2 punchy sentences saying WHY the answer is right (Gen-Z friendly, no cringe overload).
- Only use facts present in the document.

DOCUMENT:
"""
${source}
"""`;

    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });
    const raw = await result.text;

    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/[[{][\s\S]*[\]}]/);
      if (!match) throw new Error("The AI couldn't shape a quiz from this PDF. Try another file.");
      parsed = JSON.parse(match[0]);
    }

    const normalized = Array.isArray(parsed)
      ? { title: "Your Quiz", questions: parsed }
      : (parsed as { title?: unknown; questions?: unknown });

    const quiz = QuizSchema.parse({
      title: typeof normalized.title === "string" ? normalized.title : "Your Quiz",
      questions: Array.isArray(normalized.questions) ? normalized.questions : [],
    });

    const questions = quiz.questions
      .filter((q) => q.options.length >= 2 && q.correctIndex < q.options.length)
      .slice(0, data.count);

    if (!questions.length) {
      throw new Error("The AI couldn't shape a quiz from this PDF. Try another file.");
    }

    return { ...quiz, questions };
  });
