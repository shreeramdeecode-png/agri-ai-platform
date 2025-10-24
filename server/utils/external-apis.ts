import axios from "axios";
import type { ExtractedParams } from "./openai-service";

export interface ExternalApiResult {
  source: string;
  data: any;
  timestamp: Date;
}

export async function fetchFromFEWSNET(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    // FEWSNET API - Food Security Data
    // This is a placeholder. In production, use actual FEWSNET API endpoints
    const mockData = {
      country: params.country,
      foodSecurityLevel: "IPC Phase 2",
      affectedPopulation: "2.5 million",
      forecast: "Stable conditions expected through harvest season"
    };

    return {
      source: "FEWSNET",
      data: mockData,
      timestamp: new Date()
    };
  } catch (error) {
    console.error("FEWSNET API error:", error);
    return null;
  }
}

export async function fetchFromCHIRPS(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    // CHIRPS - Climate Hazards Group InfraRed Precipitation with Station data
    // Placeholder for actual CHIRPS data
    const mockData = {
      region: params.region || params.country,
      precipitation: "450mm",
      period: params.dateRange,
      anomaly: "-15% below average"
    };

    return {
      source: "CHIRPS",
      data: mockData,
      timestamp: new Date()
    };
  } catch (error) {
    console.error("CHIRPS API error:", error);
    return null;
  }
}

export async function fetchFromFAOSTAT(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    // FAOSTAT - Food and Agriculture Organization Statistics
    // Placeholder for actual FAOSTAT data
    const mockData = {
      crop: params.crop,
      country: params.country,
      production: "1.2 million tons",
      yield: "3.5 tons/hectare",
      area: "340,000 hectares"
    };

    return {
      source: "FAOSTAT",
      data: mockData,
      timestamp: new Date()
    };
  } catch (error) {
    console.error("FAOSTAT API error:", error);
    return null;
  }
}

export async function fetchFromHDX(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    // HDX - Humanitarian Data Exchange
    // Placeholder for actual HDX data
    const mockData = {
      country: params.country,
      datasets: ["Food Security", "Market Prices", "Climate Data"],
      lastUpdated: new Date().toISOString()
    };

    return {
      source: "HDX",
      data: mockData,
      timestamp: new Date()
    };
  } catch (error) {
    console.error("HDX API error:", error);
    return null;
  }
}

export async function fetchAgricultureData(params: ExtractedParams): Promise<ExternalApiResult[]> {
  const results = await Promise.allSettled([
    fetchFromFEWSNET(params),
    fetchFromCHIRPS(params),
    fetchFromFAOSTAT(params),
    fetchFromHDX(params)
  ]);

  return results
    .filter((result): result is PromiseFulfilledResult<ExternalApiResult | null> => 
      result.status === "fulfilled" && result.value !== null)
    .map(result => result.value);
}
