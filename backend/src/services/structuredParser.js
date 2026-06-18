const { GoogleGenAI, Type } = require("@google/genai");
const { z } = require("zod");

const env = require("../config/env");
const withRetry = require("../utils/withRetry");
const { validateResumeText } = require("../middleware/validate");

const ai = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

const linkSchema = {
  type: Type.OBJECT,
  required: ["label", "url"],
  properties: {
    label: { type: Type.STRING },
    url: { type: Type.STRING },
  },
};

const responseSchema = {
  type: Type.OBJECT,
  required: [
    "basics",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "interests",
  ],
  properties: {
    basics: {
      type: Type.OBJECT,
      required: ["name", "title", "location", "email", "phone", "links"],
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        location: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        links: { type: Type.ARRAY, items: linkSchema },
      },
    },
    summary: { type: Type.STRING },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["company", "role", "period", "bullets"],
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["degree", "school", "period"],
        properties: {
          degree: { type: Type.STRING },
          school: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          details: { type: Type.STRING },
        },
      },
    },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name", "description"],
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          tech: { type: Type.ARRAY, items: { type: Type.STRING } },
          links: { type: Type.ARRAY, items: linkSchema },
        },
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name"],
        properties: {
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          year: { type: Type.STRING },
        },
      },
    },
    languages: { type: Type.ARRAY, items: { type: Type.STRING } },
    interests: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

const validator = z.object({
  basics: z.object({
    name: z.string().default(""),
    title: z.string().default(""),
    location: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
  summary: z.string().default(""),
  experience: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        school: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        details: z.string().default(""),
      })
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        tech: z.array(z.string()).default([]),
        links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string().default(""),
        issuer: z.string().default(""),
        year: z.string().default(""),
      })
    )
    .default([]),
  languages: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
});

function buildPrompt(rawText) {
  return [
    "You are a resume parser. The input is text extracted from a PDF - lines may be jumbled or out of natural reading order.",
    "",
    "Extract structured data:",
    "- basics: name, professional title, location, email, phone, social links (LinkedIn / GitHub / portfolio etc.; label like \"LinkedIn\", full URL)",
    "- summary: the professional summary paragraph (rejoin if split across lines)",
    "- experience: jobs most recent first, with company, role, period (preserve original date format), location if available, and bullet points",
    "- education: degree, school, period, location, optional details",
    "- skills: flat array of technical skills",
    "- projects: name, one-sentence description, optional tech tags, optional links",
    "- certifications: name, issuer, year",
    "- languages: flat array",
    "- interests: flat array",
    "",
    "Rules:",
    "- Be conservative: omit fields that are not clearly present. Use empty strings/arrays where missing.",
    "- Do not invent or paraphrase - extract verbatim where possible.",
    "- Each experience bullet should read as a complete sentence.",
    "- Preserve original date formats (e.g. 'Jan 2022 - Dec 2023').",
    "",
    "RESUME TEXT:",
    "-----------",
    rawText,
    "-----------",
  ].join("\n");
}

const EMPTY = {
  basics: { name: "", title: "", location: "", email: "", phone: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
};

async function parseResume(rawText) {
  if (!ai) return EMPTY;

  const validText = validateResumeText(rawText);
  const prompt = buildPrompt(validText);

  const startTime = Date.now();
  let retryCount = 0;

  try {
    const result = await withRetry(async (attempt) => {
      retryCount = attempt - 1;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let text, usage;
      try {
        const res = await ai.models.generateContent({
          model: env.geminiModel,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
          },
        }, { signal: controller.signal });

        text = typeof res.text === "function" ? res.text() : res.text;
        usage = res.usageMetadata || {};
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error("Gemini request timed out");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!text) throw new Error("Empty response");

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        throw jsonErr;
      }

      let validated;
      try {
        validated = validator.parse(parsed);
      } catch (zodErr) {
        console.error(`[Gemini] Validation failures:`, zodErr.issues || zodErr.message);
        throw zodErr;
      }

      const latency = Date.now() - startTime;
      console.log(`[Gemini]\nModel: ${env.geminiModel}\nPrompt Tokens: ${usage.promptTokenCount || 0}\nResponse Tokens: ${usage.candidatesTokenCount || 0}\nLatency: ${latency}ms\nRetries: ${retryCount}`);

      return validated;
    });

    return result;
  } catch (err) {
    console.error("Structured parse failed:", err.message);
    return EMPTY;
  }
}

module.exports = { parseResume };
