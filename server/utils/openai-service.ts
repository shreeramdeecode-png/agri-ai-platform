import OpenAI from "openai";
import type { Document, Image } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an agriculture domain expert. Extract structured parameters from user queries.
Extract: crop type, country/region, date range, and overall intent.
Return JSON format: { "crop": "...", "country": "...", "region": "...", "dateRange": { "start": "...", "end": "..." }, "intent": "..." }
If information is not present, omit the field.`
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0.3,
  });

  const content = response.choices[0].message.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return { intent: query };
  }
}

export async function classifyDomain(query: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a router agent. Classify the query into one domain: Agriculture, Health, Finance, or General.
Return only the domain name in lowercase.`
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0,
  });

  const domain = response.choices[0].message.content?.toLowerCase().trim() || "general";
  return domain.includes("agriculture") || domain.includes("agri") ? "agriculture" : "general";
}

export async function searchInDocuments(query: string, documents: Document[]): Promise<string[]> {
  if (documents.length === 0) return [];

  const documentContext = documents
    .map(doc => `Document: ${doc.filename}\n${doc.extractedText?.substring(0, 2000)}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a document search assistant. Find relevant information from the provided documents.
Return relevant excerpts that answer the user's query. If no relevant information is found, return "No relevant information found."`
      },
      {
        role: "user",
        content: `Query: ${query}\n\nDocuments:\n${documentContext}`
      }
    ],
    temperature: 0.3,
  });

  const result = response.choices[0].message.content || "";
  return result.split("\n").filter(line => line.trim().length > 0);
}

export async function analyzeImage(imageUrl: string, query?: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: query || "Analyze this agricultural image and extract any relevant data, measurements, or observations."
          },
          {
            type: "image_url",
            image_url: { url: imageUrl }
          }
        ]
      }
    ],
    max_tokens: 500,
  });

  return response.choices[0].message.content || "Unable to analyze image";
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
    imageResults: imageData.length > 0 ? imageData.join("\n") : "No image data available"
  };

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an agriculture intelligence assistant. Synthesize information from multiple sources (APIs, PDFs, images) to answer user queries.
Provide clear, structured answers with source attribution.`
      },
      {
        role: "user",
        content: `Query: ${query}
        
Extracted Parameters: ${JSON.stringify(params)}

Available Data:
- API Data: ${JSON.stringify(context.apiResults)}
- PDF Data: ${context.pdfResults}
- Image Data: ${context.imageResults}

Please provide a comprehensive answer with clear source attribution (API/PDF/Image).`
      }
    ],
    temperature: 0.5,
  });

  return response.choices[0].message.content || "Unable to generate response";
}
