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
1. NEVER hallucinate. Only use facts that appear verbatim or clearly in the retrieved context below.
2. DOCUMENT PRIORITY: Retrieved document chunks (PDFs) are the highest priority source.
3. SOURCE ATTRIBUTION: Use the exact filename when attributing PDF content (e.g., "agri_ai_testing_document.pdf").
4. IMAGE RULES — CRITICAL:
   - Only set sections.image to a non-null value if the image OCR content DIRECTLY and SPECIFICALLY answers the question.
   - If image content is not relevant to the question, set sections.image to null.
   - NEVER write phrases like "Analyzed X image(s)" or "Image Source" as generic attribution.
   - Do NOT say anything came from images if the actual answer came from a document.
5. DOCUMENT RULES:
   - Only set sections.document to non-null if document chunks contain relevant content.
   - Attribute using exact filename, e.g.: "Uploaded PDF: agri_ai_testing_document.pdf [Doc-Section-1]"
6. API RULES:
   - Only set sections.api to non-null if API data directly answers the question.
7. sources.documents/images/api must be TRUE only if that source ACTUALLY contributed to the answer.
8. Confidence: 90-100% = multiple sources directly confirm; 70-89% = one source partially supports; <70% = uncertain.
9. If no source contains the information, say exactly: "The uploaded sources do not contain this information."`;

  const prompt = `Answer the following agricultural query using ONLY the retrieved data provided. Do NOT use external world knowledge.

QUESTION: ${query}

EXTRACTED PARAMETERS: ${JSON.stringify(params)}

--- RETRIEVED DOCUMENT CHUNKS (highest priority) ---
${pdfBlock}

--- RETRIEVED IMAGE/OCR DATA (only use if directly relevant to the question) ---
${imageBlock}

--- RETRIEVED API DATA ---
${apiBlock}

IMPORTANT: 
- If pdfBlock says "No document data available", set sections.document to null and sources.documents to false.
- If imageBlock says "No image data available" OR image content does not directly answer the question, set sections.image to null and sources.images to false.
- If apiBlock says "No API data available" OR API data does not answer the question, set sections.api to null and sources.api to false.
- Never attribute document content as image content or vice versa.

Return ONLY a valid JSON object (no markdown, no code fences) with EXACTLY this structure:
{
  "answer": "<concise narrative answer citing the exact source, e.g. 'According to agri_ai_testing_document.pdf [Doc-Section-1], India achieved...'> OR 'The uploaded sources do not contain this information.'",
  "sections": {
    "document": "<relevant PDF excerpt with exact filename and citation ID, OR null if documents not relevant>",
    "image": "<relevant OCR content with citation ID only if image directly answers the question, OR null>",
    "api": "<relevant API data summary with citation ID, OR null if API not relevant>",
    "aiAnalysis": "<brief synthesis of what was found and from which sources, or note if sources are insufficient>"
  },
  "confidenceScore": "<e.g. 95%>",
  "sources": {
    "documents": <true only if PDF content contributed>,
    "images": <true only if image OCR content contributed>,
    "api": <true only if API data contributed>
  },
  "citations": [
    { "id": "<e.g. Doc-Section-1>", "label": "<e.g. agri_ai_testing_document.pdf — Section on food grain production>", "source": "<exact filename or API name>" }
  ],
  "grounded": <true if every claim is from retrieved context>,
  "hallucinationDetected": <true if any claim is not in retrieved context>
}`;

  try {
    const raw = await generateText(prompt, systemInstruction);
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    const toStr = (v: any): string | undefined => {
      if (!v || v === "null" || v === "undefined" || String(v).trim() === "") return undefined;
      return String(v).trim();
    };

    return {
      answer: parsed.answer || "The sources do not contain sufficient information to answer this query.",
      sections: {
        document: toStr(parsed.sections?.document),
        image: toStr(parsed.sections?.image),
        api: toStr(parsed.sections?.api),
        aiAnalysis: toStr(parsed.sections?.aiAnalysis),
      },
      confidenceScore: parsed.confidenceScore || "N/A",
      sources: {
        documents: parsed.sources?.documents === true,
        images: parsed.sources?.images === true,
        api: parsed.sources?.api === true,
      },
      citations: Array.isArray(parsed.citations) ? parsed.citations.filter((c: any) => c?.id && c?.source) : [],
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
