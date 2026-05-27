import OpenAI from "openai";
import type { Document } from "@shared/schema";
import type {
  ExtractedParams,
  DocumentSearchResult,
  StructuredAgricultureResponse,
} from "./gemini-service";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error("OPENAI_API_KEY is not configured. Please add it to Replit Secrets."),
      { statusCode: 503, code: "MISSING_API_KEY" }
    );
  }
  return new OpenAI({ apiKey });
}

const MODEL = "gpt-4o";

export async function extractQueryIntent(query: string): Promise<ExtractedParams> {
  const today = new Date().toISOString().split("T")[0];
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an AI routing and parameter extraction engine for an agriculture intelligence platform.
Today's date is ${today}.
Rules:
- Return STRICT JSON only
- For dates, use ISO format (YYYY-MM-DD)
- If user asks for "current" or "latest", leave date_start and date_end as null
- If user specifies a year (e.g., "2024"), set date_start to "2024-01-01" and date_end to "2024-12-31"`,
      },
      {
        role: "user",
        content: `Extract parameters from the following query.

Return JSON with:
{
  "domain": "agriculture|health|finance|general",
  "intent": "price|production|weather|food_security|general",
  "crop": "commodity name or null",
  "country": "country name or null",
  "region": "region/state name or null",
  "date_start": "YYYY-MM-DD or null",
  "date_end": "YYYY-MM-DD or null"
}

User Query: ${query}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    return {
      crop: parsed.crop || undefined,
      country: parsed.country || undefined,
      region: parsed.region || undefined,
      dateRange:
        parsed.date_start || parsed.date_end
          ? { start: parsed.date_start || undefined, end: parsed.date_end || undefined }
          : undefined,
      intent: parsed.intent || query,
    };
  } catch {
    return { intent: query };
  }
}

export async function classifyDomain(query: string): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "You are a router agent. Classify the query into one domain: Agriculture, Health, Finance, or General. Return only the domain name in lowercase.",
      },
      { role: "user", content: query },
    ],
  });

  const domain = response.choices[0].message.content?.toLowerCase().trim() || "general";
  return domain.includes("agriculture") || domain.includes("agri") ? "agriculture" : "general";
}

export async function searchInDocuments(
  query: string,
  documents: Document[],
  documentIds?: string[]
): Promise<DocumentSearchResult[]> {
  let docs = documents;
  if (documentIds && documentIds.length > 0) {
    docs = documents.filter((d) => documentIds.includes(d.id));
  }
  if (docs.length === 0) return [];

  const documentContext = docs
    .map((doc) => `=== ${doc.filename} ===\n${doc.extractedText?.substring(0, 3000)}`)
    .join("\n\n");

  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a document search assistant for an agriculture platform. Find relevant information from the provided documents.
For each document that contains relevant content, return a JSON object with a "results" array. Each item must have:
- "filename": the exact document filename
- "excerpt": the relevant excerpt (max 500 chars) that answers the query

Return ONLY valid JSON: { "results": [] }. If no relevant information found, return { "results": [] }.`,
      },
      {
        role: "user",
        content: `Query: ${query}\n\nDocuments:\n${documentContext}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || '{"results":[]}');
    const items: { filename: string; excerpt: string }[] = parsed.results || [];
    return items.map((item, i) => ({
      filename: item.filename,
      excerpt: item.excerpt,
      citationId: `Doc-Section-${i + 1}`,
    }));
  } catch {
    return [];
  }
}

export async function analyzeImage(base64DataUrl: string, query?: string): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: query || "Analyze this agricultural image and extract any relevant data, measurements, or observations.",
          },
          { type: "image_url", image_url: { url: base64DataUrl } },
        ],
      },
    ],
  });

  return response.choices[0].message.content || "Unable to analyze image";
}

export async function explainPdfDocument(
  filename: string,
  extractedText: string,
  question?: string
): Promise<string> {
  const client = getClient();
  const prompt = question
    ? `Document: ${filename}\n\nContent:\n${extractedText.substring(0, 8000)}\n\nQuestion: ${question}\n\nPlease answer the question based on the document content.`
    : `Document: ${filename}\n\nContent:\n${extractedText.substring(0, 8000)}\n\nPlease provide a comprehensive summary of this document, including: main topics, key findings, important data points, and any actionable insights.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "You are an expert document analyst specializing in agriculture, food security, and humanitarian data. Provide clear, structured explanations with key findings and insights.",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "Unable to explain document";
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
    ? pdfSources.map((p) => `[${p.citationId}] (${p.filename}):\n${p.excerpt}`).join("\n\n")
    : "No document data available.";

  const imageBlock = hasImage
    ? imageSources.map((img) => `[${img.citationId}]:\n${img.text}`).join("\n\n")
    : "No image data available.";

  const client = getClient();

  const systemPrompt = `You are an enterprise-grade AI agricultural assistant with strict RAG grounding and source attribution rules.

STRICT RULES:
1. NEVER hallucinate or add information not found in retrieved sources.
2. If information is missing, say: "The uploaded sources do not contain this information."
3. Do NOT enrich answers with external world knowledge unless explicitly asked.
4. Every factual claim must come from the provided retrieved context.
5. Use precise source attribution with citation IDs like [Doc-Section-1], [Image-Q1], [API-HDXHAPI-1].
6. Confidence scoring: 90-100% = directly supported; 70-89% = partially inferred; below 70% = uncertain.
7. Document data takes priority over image assumptions if conflict exists.`;

  const userPrompt = `Answer the following agricultural query using ONLY the provided retrieved data.

QUESTION: ${query}
EXTRACTED PARAMETERS: ${JSON.stringify(params)}

--- RETRIEVED DOCUMENT CHUNKS ---
${pdfBlock}

--- RETRIEVED IMAGE/OCR DATA ---
${imageBlock}

--- RETRIEVED API DATA ---
${apiBlock}

Return a JSON object with EXACTLY this structure:
{
  "answer": "<concise narrative answer>",
  "sections": {
    "document": "<content from documents or null>",
    "image": "<content from images or null>",
    "api": "<content from API or null>",
    "aiAnalysis": "<synthesis section>"
  },
  "confidenceScore": "<percentage like 94%>",
  "sources": { "documents": true|false, "images": true|false, "api": true|false },
  "citations": [{ "id": "<id>", "label": "<label>", "source": "<source>" }],
  "grounded": true|false,
  "hallucinationDetected": true|false
}`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content || "{}");

    return {
      answer: parsed.answer || "The sources do not contain sufficient information.",
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
