const { GoogleGenAI, Type } = require("@google/genai");
const { z } = require("zod");

const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const withRetry = require("../utils/withRetry");
const { validateResumeText } = require("../middleware/validate");

const ai = env.geminiApiKey
  ? new GoogleGenAI({ apiKey: env.geminiApiKey })
  : null;

const responseSchema = {
  type: Type.OBJECT,
  required: [
    "atsScore",
    "scoreBreakdown",
    "issues",
    "strengths",
    "bulletRewrites",
    "keywordsPresent",
    "keywordsMissing",
    "summary",
  ],
  properties: {
    atsScore: { type: Type.NUMBER, description: "ATS-readiness score from 0 to 100" },
    scoreBreakdown: {
      type: Type.OBJECT,
      required: ["keywords", "formatting", "impact", "clarity"],
      properties: {
        keywords: { type: Type.NUMBER, description: "0-25" },
        formatting: { type: Type.NUMBER, description: "0-25" },
        impact: { type: Type.NUMBER, description: "0-25" },
        clarity: { type: Type.NUMBER, description: "0-25" },
      },
    },
    issues: {
      type: Type.ARRAY,
      description: "Exactly 5 prioritized issues",
      items: {
        type: Type.OBJECT,
        required: ["title", "severity", "explanation", "fix"],
        properties: {
          title: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
          explanation: { type: Type.STRING },
          fix: { type: Type.STRING },
        },
      },
    },
    strengths: {
      type: Type.ARRAY,
      description: "Exactly 5 strengths",
      items: {
        type: Type.OBJECT,
        required: ["title", "evidence"],
        properties: {
          title: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
      },
    },
    bulletRewrites: {
      type: Type.ARRAY,
      description: "5-10 weak bullets rewritten to be stronger and ATS-friendly",
      items: {
        type: Type.OBJECT,
        required: ["section", "original", "rewritten", "rationale"],
        properties: {
          section: { type: Type.STRING },
          original: { type: Type.STRING },
          rewritten: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
      },
    },
    keywordsPresent: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: {
      type: Type.STRING,
      description: "One short paragraph overall verdict",
    },
  },
};

const analysisValidator = z.object({
  atsScore: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    keywords: z.number().min(0).max(25),
    formatting: z.number().min(0).max(25),
    impact: z.number().min(0).max(25),
    clarity: z.number().min(0).max(25),
  }),
  issues: z
    .array(
      z.object({
        title: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        explanation: z.string(),
        fix: z.string(),
      })
    )
    .min(1),
  strengths: z
    .array(z.object({ title: z.string(), evidence: z.string() }))
    .min(1),
  bulletRewrites: z
    .array(
      z.object({
        section: z.string(),
        original: z.string(),
        rewritten: z.string(),
        rationale: z.string(),
      })
    )
    .default([]),
  keywordsPresent: z.array(z.string()).default([]),
  keywordsMissing: z.array(z.string()).default([]),
  summary: z.string(),
}).refine(data => {
  const sum = Object.values(data.scoreBreakdown).reduce((a, b) => a + b, 0);
  return Math.abs(sum - data.atsScore) <= 2;
}, { message: "ATS score does not match score breakdown." });

function buildPrompt({ rawText, targetRole, jobDescription }) {
  return [
    'You are a ruthless but constructive expert ATS (Applicant Tracking System) parser and senior technical recruiter. Your job is to "roast" the provided resume and offer actionable, highly specific feedback.',
    '',
    'CRITICAL CONSTRAINTS:',
    '',
    '1. Length Limits',
    '- Issues and Strengths MUST be limited to 1-2 sentences maximum per point.',
    '- Any suggested rewrites MUST be exactly one paragraph maximum.',
    '- Limit extracted keywords to at most 10.',
    '',
    '2. Scoring Consistency',
    '- Generate an atsScore (0-100).',
    '- Generate scoreBreakdown containing subscores.',
    '- The scoreBreakdown should sum as closely as possible to atsScore.',
    '',
    '3. Roasting Quality',
    '- Quote exact phrases from the resume when identifying issues.',
    '- Do not invent line numbers.',
    '- Aggressively flag clichés, vague metrics, weak action verbs, and buzzword stuffing.',
    '',
    '4. Edge Cases',
    '- No Target Role:',
    '  Evaluate against general software engineering resume best practices.',
    '',
    '- Minimal Experience:',
    '  Heavily evaluate Education and Projects.',
    '',
    '- Non-English Content:',
    '  Mention ATS parsing risks while continuing analysis.',
    '',
    '- Resume Length:',
    '  Explicitly penalize resumes that are suspiciously short or excessively long.',
    '',
    '5. Output Rules',
    '- Return valid JSON only.',
    '- Do not include markdown.',
    '- Do not include code fences.',
    '- Do not include explanatory text outside JSON.',
    '',
    targetRole ? `Target Role: ${targetRole}` : '',
    jobDescription ? `\nJob Description to match against:\n${jobDescription}\n` : '',
    '',
    'RESUME TEXT:',
    '----------',
    rawText,
    '----------'
  ].join('\n');
}

async function callGemini(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.4,
      },
    }, { signal: controller.signal });

    const text =
      typeof result.text === "function" ? result.text() : result.text;
    if (!text) throw new Error("Empty response from Gemini");

    return {
      text,
      usage: result.usageMetadata || {},
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Gemini request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function analyzeResume({ rawText, targetRole, jobDescription }) {
  if (!ai) {
    throw ApiError.internal(
      "GEMINI_API_KEY is not configured on the server."
    );
  }

  const validText = validateResumeText(rawText);
  const prompt = buildPrompt({ rawText: validText, targetRole, jobDescription });

  const startTime = Date.now();
  let retryCount = 0;

  try {
    const result = await withRetry(async (attempt) => {
      retryCount = attempt - 1;
      const { text, usage } = await callGemini(prompt);
      
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error("Failed to parse Gemini output as JSON");
      }

      let validated;
      try {
        validated = analysisValidator.parse(parsed);
      } catch (zodErr) {
        console.error(`[Gemini] Validation failures:`, zodErr.issues || zodErr.message);
        throw zodErr;
      }

      const latency = Date.now() - startTime;
      console.log(`[Gemini]\nModel: ${env.geminiModel}\nPrompt Tokens: ${usage.promptTokenCount || 0}\nResponse Tokens: ${usage.candidatesTokenCount || 0}\nLatency: ${latency}ms\nRetries: ${retryCount}`);

      return {
        analysis: validated,
        model: env.geminiModel,
        promptTokens: usage.promptTokenCount,
        responseTokens: usage.candidatesTokenCount,
      };
    });
    
    return result;
  } catch (err) {
    throw ApiError.internal(
      `Gemini analysis failed: ${err.message || "unknown error"}`
    );
  }
}

module.exports = { analyzeResume };