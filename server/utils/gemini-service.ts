import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Document } from "@shared/schema";
import type { ResponseStyle } from "@shared/query-style";
import { getStyleInstructions } from "@shared/query-style";
import { GEMINI_MODEL } from "./gemini-config";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. The external service may be slow — please try again.`)), ms)
  );
  return Promise.race([promise, timeout]);
}

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

export async function extractQueryIntent(query: string): Promise<ExtractedParams> {
  const today = new Date().toISOString().split("T")[0];
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings,
  });

  const prompt = `You are an AI routing and parameter extraction engine for an agriculture intelligence platform.
Today's date is ${today}.

Rules:
- Return STRICT JSON only
- No explanations, no markdown
- For dates, use ISO format (YYYY-MM-DD)
- If user asks for "current" or "latest", leave date_start and date_end as null
- If user specifies a year (e.g., "2024"), set date_start to "2024-01-01" and date_end to "2024-12-31"
- If user specifies a month (e.g., "January 2025"), set appropriate date range

Intent classification rules (choose EXACTLY one):
- "price": ONLY when the user explicitly asks about market prices, costs, or monetary values (e.g. "price of maize", "how much does wheat cost", "market rates for rice")
- "food_security": ONLY when the user asks about hunger, famine, food access, or IPC phases
- "production": ONLY when the user asks about yield, harvest output, or production volumes
- "weather": ONLY when the user asks about rainfall, temperature, drought, or climate conditions
- "general": for ALL other questions — fertilizer recommendations, irrigation methods, pest control, cultivation practices, NPK ratios, best practices, document questions, etc.

IMPORTANT: Mentioning a crop name does NOT make the intent "price". Use "general" for any how-to, recommendation, or knowledge question even if a crop is named.

Extract parameters from the following query and return JSON with:
{
  "domain": "agriculture|health|finance|general",
  "intent": "price|production|weather|food_security|general",
  "crop": "commodity name or null",
  "country": "country name or null",
  "region": "region/state name or null",
  "date_start": "YYYY-MM-DD or null for latest",
  "date_end": "YYYY-MM-DD or null for latest"
}

User Query: ${query}`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 25000, "Intent extraction");
    const content = result.response.text();
    const parsed = JSON.parse(content);
    return {
      crop: parsed.crop || undefined,
      country: parsed.country || undefined,
      region: parsed.region || undefined,
      dateRange:
        parsed.date_start || parsed.date_end
          ? {
              start: parsed.date_start || undefined,
              end: parsed.date_end || undefined,
            }
          : undefined,
      intent: parsed.intent || "general",
    };
  } catch {
    return { intent: "general" };
  }
}

export async function classifyDomain(query: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });
  const prompt = `Classify this query into exactly one domain: agriculture, health, finance, or general.
Return only the single lowercase domain word with no punctuation or explanation.

Query: ${query}`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 15000, "Domain classification");
    const domain = result.response.text().toLowerCase().trim();
    return domain.includes("agriculture") || domain.includes("agri") ? "agriculture" : "general";
  } catch {
    return "agriculture";
  }
}

export async function searchInDocuments(query: string, documents: Document[]): Promise<string[]> {
  if (documents.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  // Process each document separately so each result is clearly tagged with its filename.
  // This prevents source attribution from being lost when results are passed downstream.
  const results: string[] = [];

  for (const doc of documents) {
    if (!doc.extractedText || doc.extractedText.trim().length === 0) continue;

    const prompt = `You are a document analysis assistant. Read the document below and extract content relevant to the query.

QUERY: ${query}

DOCUMENT FILENAME: ${doc.filename}
DOCUMENT CONTENT:
${doc.extractedText.substring(0, 5000)}

TASK:
- If this document contains relevant information for the query, extract and summarize it precisely.
- Include specific numbers, ratios, names, dates exactly as they appear.
- If this document does NOT contain relevant information for this query, respond with exactly: NO_RELEVANT_CONTENT
- Do NOT add any prefix like "According to..." — just return the raw extracted content.`;

    try {
      const result = await withTimeout(model.generateContent(prompt), 25000, "Document search");
      const text = result.response.text().trim();
      if (text && text !== "NO_RELEVANT_CONTENT" && !text.includes("NO_RELEVANT_CONTENT")) {
        // Tag each result with its source filename so it is never lost downstream
        results.push(`[SOURCE_DOCUMENT: ${doc.filename}]\n${text}`);
      }
    } catch (error: any) {
      console.error(`Document search error for ${doc.filename}:`, error.message);
    }
  }

  return results;
}

export async function analyzePdfDocument(pdfText: string, filename: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  const prompt = `You are an expert document analyst. A PDF named "${filename}" was uploaded.
Write a SHORT summary (max 8 bullet points, under 120 words total) covering:
- What the document is about
- Key numbers or facts a user can ask questions about
- Main topics (crops, prices, schemes, etc.)

Do not use markdown bold or headers. Use plain "-" bullets only.

Document Content:
${pdfText.substring(0, 8000)}`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 30000, "PDF analysis");
    return result.response.text();
  } catch (error: any) {
    console.error("PDF analysis error:", error.message);
    return `Document "${filename}" uploaded successfully. Text extraction complete — you can now ask questions about its contents.`;
  }
}

export async function askAboutDocument(
  pdfText: string,
  filename: string,
  question: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  const prompt = `You are a document Q&A assistant. The user has a document named "${filename}" and is asking a specific question about it.

Answer the question thoroughly based ONLY on the document content provided below.
If the answer is not in the document, clearly state that.

QUESTION: ${question}

DOCUMENT CONTENT:
${pdfText.substring(0, 10000)}

Provide a detailed, accurate answer with specific references to the document where applicable.`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 30000, "Document Q&A");
    return result.response.text();
  } catch (error: any) {
    throw new Error(`Failed to process document question: ${error.message}`);
  }
}

export async function analyzeImage(dataUrl: string, query?: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data format");
  }
  const mimeType = matches[1] as "image/jpeg" | "image/png" | "image/webp";
  const base64Data = matches[2];

  const prompt =
    query ||
    `Analyze this agricultural image and provide a detailed description including:
1. What is shown in the image (crops, fields, livestock, equipment, etc.)
2. Any visible data, measurements, charts, or text
3. Observations about crop health, growth stage, or conditions
4. Any relevant agricultural insights or concerns
5. Geographic or environmental context if visible`;

  try {
    const result = await withTimeout(
      model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64Data } },
      ]),
      30000,
      "Image analysis"
    );
    return result.response.text();
  } catch (error: any) {
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}

export async function askAboutImage(
  dataUrl: string,
  filename: string,
  question: string
): Promise<string> {
  const prompt = `You are an image Q&A assistant. The user has an agricultural image named "${filename}" and is asking a specific question about it.

Answer the question based ONLY on what you can observe in the image.
If the answer cannot be determined from the image, clearly state that.

QUESTION: ${question}

Provide a detailed, accurate answer based on what is visible in the image.`;

  return analyzeImage(dataUrl, prompt);
}

export async function generateAgricultureResponse(
  query: string,
  params: ExtractedParams,
  apiData: any[],
  pdfData: string[],
  imageData: string[],
  priorContext?: string,
  responseStyle: ResponseStyle = "default"
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  // Parse tagged document results — each entry is "[SOURCE_DOCUMENT: filename]\ncontent"
  const documentSections = pdfData
    .map((entry) => {
      const match = entry.match(/^\[SOURCE_DOCUMENT: (.+?)\]\n([\s\S]+)$/);
      if (match) return { filename: match[1], content: match[2] };
      return { filename: "uploaded document", content: entry };
    });

  const hasDocumentData = documentSections.length > 0;

  const formattedDocuments = hasDocumentData
    ? documentSections
        .map((d) => `--- From: ${d.filename} ---\n${d.content}`)
        .join("\n\n")
    : "No relevant content found in uploaded documents.";

  const formattedImages = imageData.length > 0
    ? imageData.join("\n\n")
    : "No image data available.";

  const formattedApi = apiData.length > 0
    ? JSON.stringify(apiData, null, 2)
    : "No live market data available.";

  // Build the exact filename list for injection into the prompt
  const documentFilenames = documentSections.map((d) => d.filename);

  const hasLivePrice = apiData.some((d) => d?.currentPrice != null);
  const hasImages = imageData.length > 0;
  const activeSourceCount =
    (hasDocumentData ? 1 : 0) + (hasLivePrice ? 1 : 0) + (hasImages ? 1 : 0);
  const contextBlock =
    priorContext?.trim()
      ? `\nCONVERSATION CONTEXT (reference only — answer the USER QUERY):\n${priorContext.trim().slice(0, 400)}\n`
      : "";

  const sourceParts: string[] = [];
  if (hasDocumentData) sourceParts.push(documentFilenames[0]);
  if (hasImages) sourceParts.push("Image Data");
  if (hasLivePrice) sourceParts.push("Live Market API Data");
  const combinedSourceLine = sourceParts.join("; ");

  let modeInstructions: string;
  if (activeSourceCount >= 2) {
    modeInstructions = `
MULTI-SOURCE MODE — Use every relevant source section above (document, live API, and/or image).
  • Combine insights from ALL sections that apply to the query; do not ignore any source because another exists.
  • When document and live API both have prices, mention both (e.g. document table price vs HDX market price and date).
  • When document and image overlap, note agreement or useful extra detail from the image.
  • Do NOT say "no PDF", "no document", or "no image data" when that section has content above.
  • The LAST line MUST be exactly: Source: ${combinedSourceLine}`;
  } else if (hasDocumentData) {
    modeInstructions = `
DOCUMENT MODE — Answer from the uploaded document(s).
  • Do NOT say "no PDF" or "no document" when document content is shown above.
  • The LAST line MUST be: Source: ${documentFilenames[0]}`;
  } else if (hasLivePrice) {
    modeInstructions = `
MARKET API MODE — Answer using LIVE MARKET API DATA (include market/location and date).
  • The LAST line MUST be: Source: Live Market API Data`;
  } else if (hasImages) {
    modeInstructions = `
IMAGE MODE — Answer from image data above.
  • The LAST line MUST be: Source: Image Data`;
  } else {
    modeInstructions = `
KNOWLEDGE MODE — No matching document, image, or live price data.
  • Use general agriculture knowledge; state clearly if live API has no price for the requested crop.
  • The LAST line MUST be: Source: General Knowledge`;
  }

  const prompt = `You are AgriSearch AI, an expert agriculture intelligence assistant.
${contextBlock}
USER QUERY: ${query}

═══════════════════════════════════════
UPLOADED DOCUMENT CONTENT
${formattedDocuments}
═══════════════════════════════════════
LIVE MARKET API DATA
${formattedApi}
═══════════════════════════════════════
IMAGE DATA
${formattedImages}
═══════════════════════════════════════
${modeInstructions}

${getStyleInstructions(responseStyle)}

RESPONSE FORMAT:
1. Answer directly with specific facts and numbers from the source(s)
2. Follow the LENGTH rules above (one-word mode: no bullets)
3. No markdown bold, no **, no ## headers
4. Final line MUST be the Source: line as specified above — nothing after it

Answer:`;

  const result = await withTimeout(model.generateContent(prompt), 30000, "Response generation");
  return result.response.text();
}
