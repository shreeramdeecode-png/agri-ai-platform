import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { AIProviderError } from "./errors.js";

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

function getFlashModel() {
  if (!geminiClient) throw new AIProviderError("gemini", "GEMINI_API_KEY not set");
  return geminiClient.getGenerativeModel({ model: "gemini-2.0-flash", safetySettings });
}

export async function geminiExtractQueryIntent(query: string): Promise<any> {
  const model = getFlashModel();
  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are an AI parameter extraction engine for an agriculture intelligence platform.
Today's date is ${today}.

Extract parameters from the following user query and return STRICT JSON only. No markdown, no explanation.

Return exactly this JSON shape:
{
  "domain": "agriculture|health|finance|general",
  "intent": "price|production|weather|food_security|general",
  "crop": "commodity name or null",
  "country": "country name or null",
  "region": "region/state name or null",
  "date_start": "YYYY-MM-DD or null for latest",
  "date_end": "YYYY-MM-DD or null for latest"
}

Rules:
- For "current" or "latest" → leave date_start and date_end as null
- For a year like "2024" → date_start: "2024-01-01", date_end: "2024-12-31"
- For a month like "January 2025" → set appropriate date range

User Query: ${query}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
  return JSON.parse(text);
}

export async function geminiClassifyDomain(query: string): Promise<string> {
  const model = getFlashModel();

  const prompt = `Classify this query into exactly one domain: agriculture, health, finance, or general.
Return only the single word domain name in lowercase.

Query: ${query}`;

  const result = await model.generateContent(prompt);
  const domain = result.response.text().toLowerCase().trim();
  return domain.includes("agriculture") || domain.includes("agri") ? "agriculture" : "general";
}

export async function geminiSearchInChunks(query: string, chunks: { content: string; filename: string }[]): Promise<string[]> {
  if (chunks.length === 0) return [];

  const model = getFlashModel();

  const chunkContext = chunks
    .map((c, i) => `[Chunk ${i + 1} from ${c.filename}]\n${c.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are a document search assistant. Find relevant information from the provided document chunks that answers the user's query.
Return relevant excerpts with source attribution. If no relevant information exists, return "No relevant information found."

Query: ${query}

Document Chunks:
${chunkContext}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text() || "";
  return text.split("\n").filter((line) => line.trim().length > 0);
}

export async function geminiAnalyzeImage(imageData: string, mimeType: string, query?: string): Promise<string> {
  const model = getFlashModel();

  const imagePart = {
    inlineData: {
      data: imageData,
      mimeType,
    },
  };

  const prompt = query || "Analyze this agricultural image and extract any relevant data, measurements, crop types, conditions, or observations.";

  const result = await model.generateContent([prompt, imagePart]);
  return result.response.text() || "Unable to analyze image";
}

export async function geminiGenerateResponse(
  query: string,
  params: any,
  apiData: any[],
  chunkResults: string[],
  imageData: string[]
): Promise<string> {
  const model = getFlashModel();

  const context = {
    apiResults: apiData.length > 0 ? JSON.stringify(apiData) : "No API data available",
    chunkResults: chunkResults.length > 0 ? chunkResults.join("\n") : "No document data available",
    imageResults: imageData.length > 0 ? imageData.join("\n") : "No image data available",
  };

  const prompt = `You are an agriculture intelligence assistant. Synthesize information from multiple sources to answer the user query.
Provide a clear, structured answer with source attribution (API / Document / Image).

User Query: ${query}

Extracted Parameters: ${JSON.stringify(params)}

Available Data:
- API Data: ${context.apiResults}
- Document Data: ${context.chunkResults}
- Image Data: ${context.imageResults}

Provide a comprehensive answer. Attribute each fact to its source.`;

  const result = await model.generateContent(prompt);
  return result.response.text() || "Unable to generate response";
}

export function isGeminiAvailable(): boolean {
  return !!geminiClient && !!process.env.GEMINI_API_KEY;
}
