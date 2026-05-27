import type { Document } from "@shared/schema";
import type {
  ExtractedParams,
  DocumentSearchResult,
  StructuredAgricultureResponse,
} from "./gemini-service";

import * as gemini from "./gemini-service";
import * as openai from "./openai-service";

export type AIProvider = "openai" | "gemini";

export const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: "gemini", label: "Gemini", model: process.env.GEMINI_MODEL || "gemini-2.0-flash" },
  { value: "openai", label: "OpenAI", model: "GPT-4o" },
];

function svc(provider: AIProvider) {
  return provider === "openai" ? openai : gemini;
}

export function extractQueryIntent(provider: AIProvider, query: string): Promise<ExtractedParams> {
  return svc(provider).extractQueryIntent(query);
}

export function classifyDomain(provider: AIProvider, query: string): Promise<string> {
  return svc(provider).classifyDomain(query);
}

export function searchInDocuments(
  provider: AIProvider,
  query: string,
  documents: Document[],
  documentIds?: string[]
): Promise<DocumentSearchResult[]> {
  return svc(provider).searchInDocuments(query, documents, documentIds);
}

export function analyzeImage(
  provider: AIProvider,
  base64DataUrl: string,
  query?: string
): Promise<string> {
  return svc(provider).analyzeImage(base64DataUrl, query);
}

export function explainPdfDocument(
  provider: AIProvider,
  filename: string,
  extractedText: string,
  question?: string
): Promise<string> {
  return svc(provider).explainPdfDocument(filename, extractedText, question);
}

export function generateAgricultureResponse(
  provider: AIProvider,
  query: string,
  params: ExtractedParams,
  apiSources: { source: string; data: any }[],
  pdfSources: { excerpt: string; filename: string; citationId: string }[],
  imageSources: { text: string; citationId: string }[]
): Promise<StructuredAgricultureResponse> {
  return svc(provider).generateAgricultureResponse(query, params, apiSources, pdfSources, imageSources);
}
