import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const Input = z.object({
  question: z.string().min(3),
  options: z.array(z.string()).min(2),
  correctIndex: z.number(),
});

const CheckSchema = z.object({
  verdict: z.enum(["solid", "ambiguous", "wrong"]).default("solid"),
  note: z.string().default(""),
  suggestedQuestion: z.string().default(""),
  suggestedAnswer: z.string().default(""),
  sources: z
    .array(
      z.object({
        title: z.string().default("Source"),
        url: z.string().default(""),
      }),
    )
    .default([]),
});

export type FactCheck = z.infer<typeof CheckSchema>;

export const factCheckQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<FactCheck> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are a strict fact-checker for quiz questions. Cross-check the question below against widely accepted public knowledge (textbooks, encyclopedias, official docs).

QUESTION: ${data.question}
OPTIONS:
${data.options.map((o, i) => `${i}. ${o}`).join("\n")}
MARKED CORRECT: ${data.correctIndex}. ${data.options[data.correctIndex] ?? "(none)"}

Decide:
- "solid" = question is unambiguous and the marked answer is right.
- "ambiguous" = wording is unclear, multiple options could be right, or it depends on context.
- "wrong" = the marked answer is factually incorrect.

Reply with ONLY raw JSON (no fences):
{"verdict":"solid|ambiguous|wrong","note":"1-2 sentences, Gen-Z friendly, explain the issue or confirm it checks out","suggestedQuestion":"clearer rewrite, or empty string if solid","suggestedAnswer":"the correct answer, or empty string if solid","sources":[{"title":"source name","url":"https://..."}]}

Source rules: only cite real, well-known, stable pages (Wikipedia, official docs, .edu/.gov). Never invent a URL — if you are not sure a URL exists, return an empty sources array. Always include at least one source when the verdict is not "solid" and you are confident it exists.`;

    const result = streamText({ model: gateway("google/gemini-3-flash-preview"), prompt });
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
      if (!match) return CheckSchema.parse({});
      parsed = JSON.parse(match[0]);
    }

    const check = CheckSchema.parse(parsed);
    return {
      ...check,
      sources: check.sources.filter((s) => /^https?:\/\//.test(s.url)),
    };
  });
