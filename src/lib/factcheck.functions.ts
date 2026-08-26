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
  confidence: z.coerce.number().min(0).max(100).catch(50).default(50),
  confidenceReason: z.string().default(""),
  note: z.string().default(""),
  evidence: z.array(z.string()).default([]),
  rejections: z.array(z.string()).default([]),
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

    const prompt = `Fact-check this quiz question against well-established public knowledge. Be fast and terse.

Q: ${data.question}
${data.options.map((o, i) => `${i}. ${o}`).join("\n")}
MARKED CORRECT: ${data.correctIndex}

verdict: "solid" (clear + marked answer right) | "ambiguous" (unclear/multiple right) | "wrong" (marked answer false).
confidence: 0-100 certainty.

Output ONLY raw JSON, no fences:
{"verdict":"...","confidence":0,"confidenceReason":"<=12 words","note":"1 short Gen-Z sentence","evidence":["2 bullets, <=12 words each"],"rejections":["1 bullet per wrong option, <=12 words, name the option"],"suggestedQuestion":"rewrite if not solid else \\"\\"","suggestedAnswer":"correct answer if not solid else \\"\\"","sources":[{"title":"","url":"https://..."}]}

Max 1 source, only real stable pages (Wikipedia/official docs). Never invent URLs — use [] if unsure. Keep total output under 120 words.`;

    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
      maxOutputTokens: 500,
      temperature: 0,
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
      if (!match) return CheckSchema.parse({});
      parsed = JSON.parse(match[0]);
    }

    const check = CheckSchema.parse(parsed);
    return {
      ...check,
      sources: check.sources.filter((s) => /^https?:\/\//.test(s.url)),
    };
  });
