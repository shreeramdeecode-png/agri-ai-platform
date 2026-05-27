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

export async function searchInDocuments(query: string, documents: Document[], documentIds?: string[]): Promise<string[]> {
  let docs = documents;
  if (documentIds && documentIds.length > 0) {
    docs = documents.filter(d => documentIds.includes(d.id));
  }
  if (docs.length === 0) return [];

  const documentContext = docs
    .map(doc => `Document: ${doc.filename}\n${doc.extractedText?.substring(0, 2000)}`)
    .join("\n\n");

  const systemInstruction = `You are a document search assistant. Find relevant information from the provided documents.
Return relevant excerpts that answer the user's query. If no relevant information is found, return "No relevant information found."`;

  const prompt = `Query: ${query}\n\nDocuments:\n${documentContext}`;

  const result = await generateText(prompt, systemInstruction);
  return result.split("\n").filter(line => line.trim().length > 0);
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
  apiData: any[],
  pdfData: string[],
  imageData: string[]
): Promise<string> {
  const context = {
    apiResults: apiData.length > 0 ? apiData : "No API data available",
    pdfResults: pdfData.length > 0 ? pdfData.join("\n") : "No PDF data available",
    imageResults: imageData.length > 0 ? imageData.join("\n") : "No image data available",
  };

  const systemInstruction = `You are an agriculture intelligence assistant. Synthesize information from multiple sources (APIs, PDFs, images) to answer user queries.
Provide clear, structured answers with source attribution.`;

  const prompt = `Query: ${query}
        
Extracted Parameters: ${JSON.stringify(params)}

Available Data:
- API Data: ${JSON.stringify(context.apiResults)}
- PDF Data: ${context.pdfResults}
- Image Data: ${context.imageResults}

Please provide a comprehensive answer with clear source attribution (API/PDF/Image).`;

  return generateText(prompt, systemInstruction);
}
