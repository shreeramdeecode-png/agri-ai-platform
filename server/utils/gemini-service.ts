import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Document } from "@shared/schema";

export interface ExtractedParams {
  crop?: string;
  country?: string;
  region?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  intent: string;
}

export interface AgricultureData {
  source: string;
  data: any;
  confidence: number;
}

export interface CitationEntry {
  id: string;
  label: string;
  source: string;
}

export interface StructuredAgricultureResponse {
  answer: string;
  sections: {
    document?: string;
    image?: string;
    api?: string;
    aiAnalysis?: string;
  };
  confidenceScore: string;
  sources: {
    documents: boolean;
    images: boolean;
    api: boolean;
  };
  citations: CitationEntry[];
  grounded: boolean;
  hallucinationDetected: boolean;
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured. Please add it to Replit Secrets."), { statusCode: 503, code: "MISSING_API_KEY" });
  }
  return apiKey;
}

function getClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(getApiKey());
}

function getModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: getModelName(),
    ...(systemInstruction ? { systemInstruction } : {}),
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function extractQueryIntent(query: string): Promise<ExtractedParams> {
  const today = new Date().toISOString().split("T")[0];

  const systemInstruction = `You are an AI routing and parameter extraction engine for an agriculture intelligence platform.
Today's date is ${today}.

Rules:
- Return STRICT JSON only
- No explanations
- No markdown
- For dates, use ISO format (YYYY-MM-DD)
- If user asks for "current" or "latest", leave date_start and date_end as null to get most recent
- If user specifies a year (e.g., "2024"), set date_start to "2024-01-01" and date_end to "2024-12-31"
- If user specifies a month (e.g., "January 2025"), set appropriate date range`;

  const prompt = `Extract parameters from the following query.

Return JSON with:
{
  "domain": "agriculture|health|finance|general",
  "intent": "price|production|weather|food_security|general",
  "crop": "commodity name or null",
  "country": "country name or null",
  "region": "region/state name or null",
  "date_start": "YYYY-MM-DD or null for latest",
  "date_end": "YYYY-MM-DD or null for latest"
}

User Query:
${query}`;

  try {
    const text = await generateText(prompt, systemInstruction);
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      crop: parsed.crop || undefined,
      country: parsed.country || undefined,
      region: parsed.region || undefined,
      dateRange: parsed.date_start || parsed.date_end
        ? { start: parsed.date_start || undefined, end: parsed.date_end || undefined }
        : undefined,
      intent: parsed.intent || query,
    };
  } catch {
    return { intent: query };
  }
}

export async function classifyDomain(query: string): Promise<string> {
  const systemInstruction = `You are a router agent. Classify the query into one domain: Agriculture, Health, Finance, or General.
Return only the domain name in lowercase.`;

  const text = await generateText(query, systemInstruction);
  const domain = text.toLowerCase().trim();
  return domain.includes("agriculture") || domain.includes("agri") ? "agriculture" : "general";
}

export interface DocumentSearchResult {
  excerpt: string;
  filename: string;
  citationId: string;
}

export async function searchInDocuments(
  query: string,
  documents: Document[],
  documentIds?: string[]
): Promise<DocumentSearchResult[]> {
  let docs = documents;
  if (documentIds && documentIds.length > 0) {
    docs = documents.filter(d => documentIds.includes(d.id));
  }
  if (docs.length === 0) return [];

  const systemInstruction = `You are a document search assistant for an agriculture platform. Find relevant information from the provided documents.
For each document that contains relevant content, return a JSON array of objects. Each object must have:
- "filename": the exact document filename
- "excerpt": the relevant excerpt (max 500 chars) that answers the query

Return ONLY a valid JSON array. If no relevant information found, return [].`;

  const documentContext = docs
    .map(doc => `=== ${doc.filename} ===\n${doc.extractedText?.substring(0, 3000)}`)
    .join("\n\n");

  const prompt = `Query: ${query}\n\nDocuments:\n${documentContext}`;

  try {
    const raw = await generateText(prompt, systemInstruction);
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed: { filename: string; excerpt: string }[] = JSON.parse(clean);
    return parsed.map((item, i) => ({
      filename: item.filename,
      excerpt: item.excerpt,
      citationId: `Doc-Section-${i + 1}`,
    }));
  } catch {
    return [];
  }
}

export async function explainPdfDocument(filename: string, extractedText: string, question?: string): Promise<string> {
  const systemInstruction = `You are an expert document analyst specializing in agriculture, food security, and humanitarian data.
Provide clear, structured explanations with key findings and insights.`;

  const prompt = question
    ? `Document: ${filename}\n\nContent:\n${extractedText.substring(0, 8000)}\n\nQuestion: ${question}\n\nPlease answer the question based on the document content.`
    : `Document: ${filename}\n\nContent:\n${extractedText.substring(0, 8000)}\n\nPlease provide a comprehensive summary of this document, including: main topics, key findings, important data points, and any actionable insights.`;

  return generateText(prompt, systemInstruction);
}

export async function analyzeImage(base64DataUrl: string, query?: string): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: getModelName() });

  const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image data URL");

  const mimeType = matches[1] as any;
  const base64Data = matches[2];

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    query || "Analyze this agricultural image and extract any relevant data, measurements, or observations.",
  ]);

  return result.response.text() || "Unable to analyze image";
}

export async function generateAgricultureResponse(
  query: string,
  params: ExtractedParams,
  apiSources: { source: string; data: any }[],
  pdfSources: { excerpt: string; filename: string; citationId: string }[],
  imageSources: { text: string; citationId: string }[]
): Promise<StructuredAgricultureResponse> {
  const hasApi = apiSources.length > 0;
  const hasPdf = pdfSources.length > 0;
  const hasImage = imageSources.length > 0;

  const apiBlock = hasApi
    ? apiSources.map((a, i) => `[API-${a.source.replace(/\s+/g, "-")}-${i + 1}]:\n${JSON.stringify(a.data, null, 2)}`).join("\n\n")
    : "No API data available.";

  const pdfBlock = hasPdf
    ? pdfSources.map(p => `[${p.citationId}] (${p.filename}):\n${p.excerpt}`).join("\n\n")
    : "No document data available.";

  const imageBlock = hasImage
    ? imageSources.map(img => `[${img.citationId}]:\n${img.text}`).join("\n\n")
    : "No image data available.";

  const systemInstruction = `You are an enterprise-grade AI agricultural assistant with strict RAG grounding and source attribution rules.

STRICT RULES:
1. NEVER hallucinate or add information not found in retrieved sources.
2. If information is missing, say: "The uploaded sources do not contain this information."
3. Do NOT enrich answers with external world knowledge unless explicitly asked.
4. Every factual claim must come from the provided retrieved context.
5. Use precise source attribution with citation IDs like [Doc-Section-1], [Image-Q1], [API-HDXHAPI-1].
6. Confidence scoring: 90-100% = directly supported by multiple sources; 70-89% = partially inferred; below 70% = uncertain.
7. Document data takes priority over image assumptions if conflict exists.
8. If retrieval confidence is low, say information is insufficient instead of speculating.`;

  const prompt = `You are answering the following agricultural query. Use ONLY the provided retrieved data — do not add external knowledge.

QUESTION: ${query}

EXTRACTED PARAMETERS: ${JSON.stringify(params)}

--- RETRIEVED DOCUMENT CHUNKS ---
${pdfBlock}

--- RETRIEVED IMAGE/OCR DATA ---
${imageBlock}

--- RETRIEVED API DATA ---
${apiBlock}

Return your answer as a valid JSON object (no markdown, no code fences) with EXACTLY this structure:
{
  "answer": "<concise narrative answer using only retrieved data, or state sources do not contain this information>",
  "sections": {
    "document": "<content from documents or null>",
    "image": "<content from images or null>",
    "api": "<content from API or null>",
    "aiAnalysis": "<synthesis and analysis section>"
  },
  "confidenceScore": "<percentage like 94%>",
  "sources": {
    "documents": <true|false>,
    "images": <true|false>,
    "api": <true|false>
  },
  "citations": [
    { "id": "<citation id>", "label": "<human label>", "source": "<source name>" }
  ],
  "grounded": <true|false>,
  "hallucinationDetected": <true|false>
}`;

  try {
    const raw = await generateText(prompt, systemInstruction);
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      answer: parsed.answer || "The sources do not contain sufficient information to answer this query.",
      sections: {
        document: parsed.sections?.document || undefined,
        image: parsed.sections?.image || undefined,
        api: parsed.sections?.api || undefined,
        aiAnalysis: parsed.sections?.aiAnalysis || undefined,
      },
      confidenceScore: parsed.confidenceScore || "N/A",
      sources: {
        documents: parsed.sources?.documents ?? hasPdf,
        images: parsed.sources?.images ?? hasImage,
        api: parsed.sources?.api ?? hasApi,
      },
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      grounded: parsed.grounded ?? true,
      hallucinationDetected: parsed.hallucinationDetected ?? false,
    };
  } catch {
    return {
      answer: "Unable to generate a structured response. Please try again.",
      sections: {},
      confidenceScore: "0%",
      sources: { documents: hasPdf, images: hasImage, api: hasApi },
      citations: [],
      grounded: false,
      hallucinationDetected: false,
    };
  }
}
