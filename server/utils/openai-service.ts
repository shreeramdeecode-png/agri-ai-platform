import OpenAI from "openai";
import type { Document, DocumentChunk } from "@shared/schema";
import { withTimeout, withRetry, getCached, setCache, cacheKey } from "./timeout.js";
import { AIProviderError } from "./errors.js";
import {
  geminiExtractQueryIntent,
  geminiClassifyDomain,
  geminiSearchInChunks,
  geminiAnalyzeImage,
  geminiGenerateResponse,
  isGeminiAvailable,
} from "./gemini-service.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export let lastUsedProvider = "openai";

export interface ExtractedParams {
  crop?: string;
  country?: string;
  region?: string;
  dateRange?: { start?: string; end?: string };
  intent: string;
}

// ─── Provider Abstraction ──────────────────────────────────────────────────

export async function extractQueryIntent(query: string): Promise<ExtractedParams> {
  const key = cacheKey("intent", query);
  const cached = getCached<ExtractedParams>(key);
  if (cached) return cached;

  const run = async (): Promise<ExtractedParams> => {
    if (isGeminiAvailable()) {
      try {
        const parsed = await withTimeout(geminiExtractQueryIntent(query), 20000, "gemini:extractQueryIntent");
        lastUsedProvider = "gemini";
        return {
          crop: parsed.crop || undefined,
          country: parsed.country || undefined,
          region: parsed.region || undefined,
          dateRange: (parsed.date_start || parsed.date_end)
            ? { start: parsed.date_start || undefined, end: parsed.date_end || undefined }
            : undefined,
          intent: parsed.intent || query,
        };
      } catch (geminiErr: any) {
        console.warn("[ai-provider] Gemini extractQueryIntent failed, falling back to OpenAI:", geminiErr.message);
      }
    }

    // OpenAI fallback
    const today = new Date().toISOString().split("T")[0];
    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI routing and parameter extraction engine for an agriculture intelligence platform.
Today's date is ${today}.
Rules:
- Return STRICT JSON only
- No explanations, no markdown
- For dates use ISO format (YYYY-MM-DD)
- If user asks for "current" or "latest", leave date_start and date_end as null
- If user specifies a year (e.g., "2024"), set date_start to "2024-01-01" and date_end to "2024-12-31"
- If user specifies a month (e.g., "January 2025"), set appropriate date range`,
          },
          {
            role: "user",
            content: `Extract parameters from the following query.
Return JSON: { "domain": "agriculture|health|finance|general", "intent": "price|production|weather|food_security|general", "crop": "...|null", "country": "...|null", "region": "...|null", "date_start": "YYYY-MM-DD|null", "date_end": "YYYY-MM-DD|null" }

User Query: ${query}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      25000,
      "openai:extractQueryIntent"
    );

    lastUsedProvider = "openai";
    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);
    return {
      crop: parsed.crop || undefined,
      country: parsed.country || undefined,
      region: parsed.region || undefined,
      dateRange: (parsed.date_start || parsed.date_end)
        ? { start: parsed.date_start || undefined, end: parsed.date_end || undefined }
        : undefined,
      intent: parsed.intent || query,
    };
  };

  const result = await withRetry(run, 1, 1000, "extractQueryIntent");
  setCache(key, result, 10 * 60 * 1000);
  return result;
}

export async function classifyDomain(query: string): Promise<string> {
  const key = cacheKey("domain", query);
  const cached = getCached<string>(key);
  if (cached) return cached;

  const run = async (): Promise<string> => {
    if (isGeminiAvailable()) {
      try {
        const domain = await withTimeout(geminiClassifyDomain(query), 15000, "gemini:classifyDomain");
        lastUsedProvider = "gemini";
        setCache(key, domain, 10 * 60 * 1000);
        return domain;
      } catch (geminiErr: any) {
        console.warn("[ai-provider] Gemini classifyDomain failed, falling back to OpenAI:", geminiErr.message);
      }
    }

    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a router agent. Classify the query into one domain: Agriculture, Health, Finance, or General. Return only the domain name in lowercase." },
          { role: "user", content: query },
        ],
        temperature: 0,
      }),
      20000,
      "openai:classifyDomain"
    );

    lastUsedProvider = "openai";
    const domain = response.choices[0].message.content?.toLowerCase().trim() || "general";
    const result = domain.includes("agriculture") || domain.includes("agri") ? "agriculture" : "general";
    setCache(key, result, 10 * 60 * 1000);
    return result;
  };

  return withRetry(run, 1, 1000, "classifyDomain");
}

export async function searchInDocuments(query: string, documents: Document[]): Promise<string[]> {
  if (documents.length === 0) return [];

  const documentContext = documents
    .map((doc) => `Document: ${doc.filename}\n${doc.extractedText?.substring(0, 2000)}`)
    .join("\n\n");

  const response = await withTimeout(
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a document search assistant. Find relevant information from the provided documents. Return relevant excerpts that answer the user's query. If no relevant information is found, return 'No relevant information found.'" },
        { role: "user", content: `Query: ${query}\n\nDocuments:\n${documentContext}` },
      ],
      temperature: 0.3,
    }),
    30000,
    "openai:searchInDocuments"
  );

  const result = response.choices[0].message.content || "";
  return result.split("\n").filter((line) => line.trim().length > 0);
}

export async function searchInChunks(
  query: string,
  chunks: DocumentChunk[],
  topK = 6
): Promise<string[]> {
  if (chunks.length === 0) return [];

  const scoredChunks = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarityFromText(query, chunk.content),
  }));

  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks.slice(0, topK).map((s) => ({
    content: s.chunk.content,
    filename: "Document",
  }));

  if (isGeminiAvailable()) {
    try {
      return await withTimeout(
        geminiSearchInChunks(query, topChunks),
        25000,
        "gemini:searchInChunks"
      );
    } catch (err: any) {
      console.warn("[ai-provider] Gemini searchInChunks failed, falling back to OpenAI:", err.message);
    }
  }

  const chunkContext = topChunks
    .map((c, i) => `[Chunk ${i + 1}]\n${c.content}`)
    .join("\n\n---\n\n");

  const response = await withTimeout(
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a document search assistant. Find relevant information from the provided document chunks. Return relevant excerpts with context." },
        { role: "user", content: `Query: ${query}\n\nDocument Chunks:\n${chunkContext}` },
      ],
      temperature: 0.3,
    }),
    30000,
    "openai:searchInChunks"
  );

  const result = response.choices[0].message.content || "";
  return result.split("\n").filter((line) => line.trim().length > 0);
}

function cosineSimilarityFromText(query: string, text: string): number {
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const textWords = text.toLowerCase().split(/\s+/);
  let matches = 0;
  for (const word of textWords) {
    if (queryWords.has(word)) matches++;
  }
  return matches / Math.max(textWords.length, 1);
}

export async function analyzeImage(imageUrl: string, query?: string): Promise<string> {
  if (imageUrl.startsWith("data:") && isGeminiAvailable()) {
    try {
      const [meta, data] = imageUrl.split(",");
      const mimeType = meta.match(/data:([^;]+)/)?.[1] || "image/jpeg";
      return await withTimeout(
        geminiAnalyzeImage(data, mimeType, query),
        30000,
        "gemini:analyzeImage"
      );
    } catch (err: any) {
      console.warn("[ai-provider] Gemini analyzeImage failed, falling back to OpenAI:", err.message);
    }
  }

  const response = await withTimeout(
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: query || "Analyze this agricultural image and extract any relevant data, measurements, or observations." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 500,
    }),
    30000,
    "openai:analyzeImage"
  );

  return response.choices[0].message.content || "Unable to analyze image";
}

export async function generateAgricultureResponse(
  query: string,
  params: ExtractedParams,
  apiData: any[],
  pdfData: string[],
  imageData: string[]
): Promise<string> {
  const key = cacheKey("response", query, JSON.stringify(params));
  const cached = getCached<string>(key);
  if (cached) return cached;

  const run = async (): Promise<string> => {
    if (isGeminiAvailable()) {
      try {
        const result = await withTimeout(
          geminiGenerateResponse(query, params, apiData, pdfData, imageData),
          45000,
          "gemini:generateAgricultureResponse"
        );
        lastUsedProvider = "gemini";
        return result;
      } catch (err: any) {
        console.warn("[ai-provider] Gemini generateResponse failed, falling back to OpenAI:", err.message);
      }
    }

    const context = {
      apiResults: apiData.length > 0 ? apiData : "No API data available",
      pdfResults: pdfData.length > 0 ? pdfData.join("\n") : "No PDF data available",
      imageResults: imageData.length > 0 ? imageData.join("\n") : "No image data available",
    };

    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an agriculture intelligence assistant. Synthesize information from multiple sources (APIs, PDFs, images) to answer user queries. Provide clear, structured answers with source attribution." },
          {
            role: "user",
            content: `Query: ${query}

Extracted Parameters: ${JSON.stringify(params)}

Available Data:
- API Data: ${JSON.stringify(context.apiResults)}
- PDF Data: ${context.pdfResults}
- Image Data: ${context.imageResults}

Provide a comprehensive answer with clear source attribution (API/PDF/Image).`,
          },
        ],
        temperature: 0.5,
      }),
      45000,
      "openai:generateAgricultureResponse"
    );

    lastUsedProvider = "openai";
    return response.choices[0].message.content || "Unable to generate response";
  };

  const result = await withRetry(run, 1, 2000, "generateAgricultureResponse");
  setCache(key, result, 5 * 60 * 1000);
  return result;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await withTimeout(
      openai.embeddings.create({ model: "text-embedding-3-small", input: text.substring(0, 8000) }),
      20000,
      "openai:generateEmbedding"
    );
    return response.data[0].embedding;
  } catch (err: any) {
    console.warn("[embedding] Failed to generate embedding:", err.message);
    return null;
  }
}
