import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Document, Image } from "@shared/schema";
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

const SOURCE_DOCUMENT_TAG = /^\[SOURCE_DOCUMENT: (.+?)\]\n([\s\S]+)$/;
const SOURCE_IMAGE_TAG = /^\[SOURCE_IMAGE: (.+?)\]\n([\s\S]+)$/;

export function parseTaggedSource(
  entry: string,
  kind: "document" | "image"
): { filename: string; content: string } | null {
  const re = kind === "document" ? SOURCE_DOCUMENT_TAG : SOURCE_IMAGE_TAG;
  const match = entry.match(re);
  if (match) return { filename: match[1], content: match[2].trim() };
  return null;
}

export function ensureSourceLine(text: string, sourceLabel: string): string {
  const trimmed = text.trim();
  if (/^Source:\s*.+$/im.test(trimmed)) return trimmed;
  return `${trimmed}\n\nSource: ${sourceLabel}`;
}

/** True when a file-source reply has no usable facts for the user's question. */
export function isInsufficientSourceAnswer(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "NO_ANSWER_IN_SOURCE" || trimmed.includes("NO_ANSWER_IN_SOURCE")) {
    return true;
  }
  const body = trimmed.replace(/\n*Source:\s*.+$/i, "").trim().toLowerCase();
  if (body.length < 20) return true;

  const negative =
    /does not provide|does not contain|do not provide|cannot be determined|not available in|excerpt does not|file does not|image does not|document does not|no (?:specific )?information|not (?:directly )?answer|only (?:lists?|mentions?|addresses?) the question/i;
  const bodyOnly = trimmed.replace(/\n*Source:.*$/i, "");
  const hasSubstantiveBullet = bodyOnly
    .split("\n")
    .some((line) => /^-\s+/.test(line.trim()) && line.trim().length > 30);

  if (negative.test(body) && !hasSubstantiveBullet) return true;
  if (/does not provide/i.test(body) && /addresses|mentions/i.test(body)) return true;
  return false;
}

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
  const seenFilenames = new Set<string>();

  for (const doc of documents) {
    if (!doc.extractedText || doc.extractedText.trim().length === 0) continue;
    if (seenFilenames.has(doc.filename)) continue;
    seenFilenames.add(doc.filename);

    const prompt = `You are a document analysis assistant. Read the document below and extract content relevant to the query.

QUERY: ${query}

DOCUMENT FILENAME: ${doc.filename}
DOCUMENT CONTENT:
${doc.extractedText.substring(0, 9000)}

TASK:
- Extract only facts that directly answer the query (3-8 "-" bullets). Copy method names, numbers, and scheme names exactly.
- Do NOT list unrelated sections or meta descriptions.
- If this document does NOT contain relevant information for this query, respond with exactly: NO_RELEVANT_CONTENT
- Do NOT add any prefix like "According to..." — return only the extracted content.`;

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

export async function searchInImages(query: string, images: Image[]): Promise<string[]> {
  if (images.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });
  const results: string[] = [];
  const seenFilenames = new Set<string>();

  for (const img of images) {
    if (!img.extractedData || img.extractedData.trim().length === 0) continue;
    if (seenFilenames.has(img.filename)) continue;
    seenFilenames.add(img.filename);

    const prompt = `You are an image catalog search assistant. The user uploaded an image; below is a text catalog of what it shows (not the raw image).

QUERY: ${query}

IMAGE FILENAME: ${img.filename}
IMAGE CATALOG:
${img.extractedData.substring(0, 4000)}

TASK:
- Extract only facts that directly answer the query (3-6 "-" bullets). Do not return the question text alone.
- If the catalog only mentions a topic as a question without factual answers, respond with exactly: NO_RELEVANT_CONTENT
- If this image does NOT help answer the query, respond with exactly: NO_RELEVANT_CONTENT
- Do NOT add prefixes like "According to the image..." — return only the extracted points.`;

    try {
      const result = await withTimeout(model.generateContent(prompt), 25000, "Image search");
      const text = result.response.text().trim();
      if (text && text !== "NO_RELEVANT_CONTENT" && !text.includes("NO_RELEVANT_CONTENT")) {
        results.push(`[SOURCE_IMAGE: ${img.filename}]\n${text}`);
      }
    } catch (error: any) {
      console.error(`Image search error for ${img.filename}:`, error.message);
    }
  }

  return results;
}

export async function analyzePdfDocument(pdfText: string, filename: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  const prompt = `You are an expert document analyst. A PDF named "${filename}" was uploaded.
List what is INSIDE this document so the user can see its full scope. Use plain "-" bullets only (no bold, no ## headers).

Structure your response as:
- One opening bullet: what the document is for
- Section bullets: for each major section/topic in the document, one bullet with the section name and its key facts (include exact numbers, NPK ratios, percentages, dates)
- Table/data bullets: list each price or commodity row with exact values (crop, location, prices, dates)
- Closing bullet: sample questions or topics the user can ask about (if listed in the doc)

Target 14-20 bullets and about 200-280 words. Be specific — copy figures and names from the text.

Document Content:
${pdfText.substring(0, 10000)}`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 30000, "PDF analysis");
    return ensureSourceLine(result.response.text(), filename);
  } catch (error: any) {
    console.error("PDF analysis error:", error.message);
    return ensureSourceLine(
      `Document "${filename}" uploaded successfully. You can now ask questions about its contents.`,
      filename
    );
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

export type AnalyzeImageOptions = {
  prompt?: string;
  filename?: string;
  /** Short catalog for search indexing (upload). */
  catalog?: boolean;
};

export async function analyzeImage(
  dataUrl: string,
  options?: string | AnalyzeImageOptions
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data format");
  }
  const mimeType = matches[1] as "image/jpeg" | "image/png" | "image/webp";
  const base64Data = matches[2];

  const opts: AnalyzeImageOptions =
    typeof options === "string" ? { prompt: options } : options ?? {};
  const filename = opts.filename ?? "uploaded image";

  const prompt =
    opts.prompt ??
    (opts.catalog !== false
      ? `You are an expert analyst. Summarize what is INSIDE this agriculture image/infographic — same style as a PDF section summary. Plain "-" bullets only (no bold, no ## headers).

Do NOT list questions as a numbered 1–10 list. Do NOT mention icons. Instead group content by topic.

Structure:
- One opening bullet: image title, tagline, and purpose (e.g. infographic for testing agriculture Q&A)
- Topic bullets: one bullet per major theme shown (e.g. "Food Security in India:", "Commodity Prices:", "Weather Impact:", "Fertilizer & Wheat:", "Government Schemes:", etc.) — each bullet names the theme and summarizes what the image asks or shows about it in one sentence
- Visuals bullet: summarize all photo panels in 1-2 bullets (fields, equipment, crops, irrigation, drone, produce — not one bullet per photo unless there are only 2-3)
- Closing bullet: overall topics a user can ask about based on this image

Target 10-14 bullets and about 200-280 words. Match the concise section-summary style used for PDF uploads.`
      : `Analyze this agricultural image (plain "-" bullets, ~200 words):
- Title and purpose in one bullet
- Topic-summary bullets (not a numbered question list)
- Brief summary of photos shown`);

  try {
    const result = await withTimeout(
      model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64Data } },
      ]),
      30000,
      "Image analysis"
    );
    const text = result.response.text();
    return ensureSourceLine(text, filename);
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

  return analyzeImage(dataUrl, { prompt, filename });
}

export type GeneralAnswerOptions = {
  /** User files already answer this — keep GK/API supplement short. */
  briefBecauseFiles?: boolean;
};

/** Answer the user query from API data and general knowledge only (not uploaded files). */
export async function generateGeneralAnswer(
  query: string,
  params: ExtractedParams,
  apiData: any[],
  priorContext?: string,
  responseStyle: ResponseStyle = "default",
  options?: GeneralAnswerOptions
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });

  const formattedApi =
    apiData.length > 0 ? JSON.stringify(apiData, null, 2) : "No live API data returned for this query.";

  const hasLivePrice = apiData.some((d) => d?.currentPrice != null);
  const hasFoodSecurity = apiData.some(
    (d) => d?.ipcPhase != null || d?.populationInNeed != null
  );

  const contextBlock = priorContext?.trim()
    ? `\nCONVERSATION CONTEXT (reference only):\n${priorContext.trim().slice(0, 400)}\n`
    : "";

  let sourceLine = "General Knowledge";
  if (hasLivePrice && hasFoodSecurity) sourceLine = "Live Market API Data; HDX Food Security; General Knowledge";
  else if (hasLivePrice) sourceLine = "Live Market API Data; General Knowledge";
  else if (hasFoodSecurity) sourceLine = "HDX Food Security; General Knowledge";

  const prompt = `You are AgriSearch AI, an expert agriculture intelligence assistant.
${contextBlock}
USER QUERY: ${query}
EXTRACTED CONTEXT: ${JSON.stringify(params)}

═══════════════════════════════════════
LIVE API DATA (use when present; include dates and locations)
${formattedApi}
═══════════════════════════════════════

PRIMARY ANSWER RULES:
${
  options?.briefBecauseFiles
    ? `- The user has uploaded document(s)/image(s) that answer this question — those appear in separate messages.
- Keep this reply SHORT: max 3 "-" bullets (about 60 words) with only live API data or general tips NOT already in their files.
- If live API has no data for this query, use exactly one sentence pointing to uploaded files, then at most 2 brief general tips.`
    : `- Answer the USER QUERY directly using live API data when available, then supplement with sound general agriculture knowledge.
- Uploaded files are handled separately — do NOT say information is unavailable because a user document exists.
- If API data is empty or does not cover the query, answer from general knowledge without refusing.
- Do NOT mention "no PDF", "no document", or "no image" in this response.`
}

${getStyleInstructions(responseStyle)}

RESPONSE FORMAT:
1. Answer directly; use "-" bullets when listing facts (unless one-word mode).
2. No markdown bold, no **, no ## headers.
3. The LAST line MUST be exactly: Source: ${sourceLine}

Answer:`;

  const result = await withTimeout(model.generateContent(prompt), 30000, "General answer");
  return result.response.text();
}

/** Format a query-specific answer from one document or image excerpt. */
export async function generateSourceAnswer(
  query: string,
  taggedEntry: string,
  kind: "document" | "image",
  responseStyle: ResponseStyle = "default"
): Promise<string | null> {
  const parsed = parseTaggedSource(taggedEntry, kind);
  if (!parsed) return null;

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, safetySettings });
  const kindLabel = kind === "document" ? "document" : "image";

  const inventoryQuery =
    /analyze uploaded|what(?:'s| is) in (?:the |this )?(?:file|document|pdf|image)|describe (?:the |this )?(?:file|document|pdf|image)|list (?:the )?contents?/i.test(
      query
    );

  const prompt = inventoryQuery
    ? `You are AgriSearch AI. The user wants an overview of a ${kindLabel}. Use ONLY the excerpt below.

${kind.toUpperCase()} FILENAME: ${parsed.filename}
EXCERPT:
${parsed.content}

RULES:
- Summarize what is inside using 10-14 "-" bullets in PDF-style section summaries (Topic name: key points).
${kind === "image" ? "- Do NOT list questions as numbered 1–10 or mention icons — group by theme." : "- Include exact numbers, prices, and scheme names when in the excerpt."}
- About 200-280 words. No markdown bold or ## headers.
- The LAST line MUST be exactly: Source: ${parsed.filename}

Answer:`
    : `You are AgriSearch AI. Answer the user's question using ONLY what this ${kindLabel} excerpt says.

USER QUERY: ${query}

${kind.toUpperCase()} FILENAME: ${parsed.filename}
EXCERPT:
${parsed.content}

RULES:
- Give 3-6 "-" bullets with direct answers from the excerpt only (methods, numbers, schemes, recommendations — copy names exactly).
- Do NOT add "Content in this document/image" or meta bullets like "Central theme:" or "Insights sought:".
- Do NOT repeat the question or describe what the file is about — only state facts from the file that answer the query.
- If the excerpt lacks facts to answer the query (e.g. only lists a question title), respond with exactly: NO_ANSWER_IN_SOURCE
- Max 100 words. No markdown bold or ## headers.
- If you have a real answer, the LAST line MUST be exactly: Source: ${parsed.filename}

Answer:`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 25000, `${kindLabel} answer`);
    const raw = result.response.text().trim();
    if (isInsufficientSourceAnswer(raw)) return null;
    return ensureSourceLine(raw, parsed.filename);
  } catch (error: any) {
    console.error(`Source answer error (${parsed.filename}):`, error.message);
    return null;
  }
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
