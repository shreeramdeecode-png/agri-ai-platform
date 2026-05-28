import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Document } from "@shared/schema";

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
    model: "gemini-1.5-flash",
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
      intent: parsed.intent || query,
    };
  } catch {
    return { intent: query };
  }
}

export async function classifyDomain(query: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
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

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

  const documentContext = documents
    .map((doc) => `=== Document: ${doc.filename} ===\n${doc.extractedText?.substring(0, 4000) || "(empty)"}`)
    .join("\n\n");

  const prompt = `You are a document analysis assistant for an agriculture intelligence platform.
The user has uploaded the following documents. Carefully read them and answer the query below.

TASK:
- Find all relevant information from these documents that answers the user's query
- Quote or paraphrase specific data points, statistics, or conclusions from the documents
- If a document is not relevant, skip it
- If no document contains relevant information, respond with exactly: "No relevant information found in uploaded documents."

QUERY: ${query}

DOCUMENTS:
${documentContext}

Provide a thorough, structured answer citing which document each piece of information comes from.`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 30000, "Document search");
    const text = result.response.text();
    return text.split("\n").filter((line) => line.trim().length > 0);
  } catch (error: any) {
    console.error("Document search error:", error.message);
    return [];
  }
}

export async function analyzePdfDocument(pdfText: string, filename: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

  const prompt = `You are an expert document analyst. A PDF document named "${filename}" has been uploaded.
Please provide a comprehensive analysis of this document including:

1. **Document Overview** — What type of document is this and what is its main purpose?
2. **Key Findings** — The most important data, statistics, or conclusions
3. **Topics Covered** — Main subjects and themes discussed
4. **Data & Metrics** — Any specific numbers, percentages, or measurements mentioned
5. **Relevance** — How this document relates to agriculture, food security, or market data

Document Content:
${pdfText.substring(0, 8000)}

Provide a clear, structured analysis that will help users understand what information they can ask about from this document.`;

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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

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

export async function generateAgricultureResponse(
  query: string,
  params: ExtractedParams,
  apiData: any[],
  pdfData: string[],
  imageData: string[]
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

  const context = {
    apiResults: apiData.length > 0 ? JSON.stringify(apiData, null, 2) : "No live API data available",
    pdfResults: pdfData.length > 0 ? pdfData.join("\n") : "No document data available",
    imageResults: imageData.length > 0 ? imageData.join("\n") : "No image data available",
  };

  const prompt = `You are AgriSearch AI, an expert agriculture intelligence assistant powered by real-time data.

USER QUERY: ${query}

EXTRACTED PARAMETERS:
- Crop/Commodity: ${params.crop || "Not specified"}
- Country/Region: ${params.country || "Not specified"} ${params.region ? `/ ${params.region}` : ""}
- Date Range: ${params.dateRange ? `${params.dateRange.start || "N/A"} to ${params.dateRange.end || "N/A"}` : "Most recent available"}
- Intent: ${params.intent}

DATA SOURCES:
📊 Live API Data:
${context.apiResults}

📄 Document Data:
${context.pdfResults}

🖼️ Image Analysis:
${context.imageResults}

INSTRUCTIONS:
1. Synthesize all available data to give a comprehensive, accurate answer
2. Lead with the most important/relevant information
3. Include specific numbers, prices, dates when available from the data
4. Clearly attribute which source each piece of information comes from (e.g., "According to HDX HAPI data...", "From your uploaded document...", "Image analysis shows...")
5. If data is limited, acknowledge what was found and suggest what additional information might help
6. Use clear formatting with bullet points or sections when appropriate
7. Be direct and informative — avoid filler phrases

Provide a thorough, well-structured response:`;

  const result = await withTimeout(model.generateContent(prompt), 30000, "Response generation");
  return result.response.text();
}
