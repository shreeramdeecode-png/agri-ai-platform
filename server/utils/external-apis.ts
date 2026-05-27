import axios from "axios";
import type { ExtractedParams } from "./gemini-service";

export interface ExternalApiResult {
  source: string;
  data: any;
  timestamp: Date;
}

export interface FewsNetPriceData {
  crop: string;
  country: string;
  market: string;
  price: number;
  unit: string;
  currency: string;
  date: string;
  source: string;
}

const HDX_HAPI_BASE = "https://hapi.humdata.org/api/v1";

let cachedAppIdentifier: string | null = null;

async function getAppIdentifier(): Promise<string> {
  if (cachedAppIdentifier) return cachedAppIdentifier;
  
  try {
    const response = await axios.get(`${HDX_HAPI_BASE}/encode_app_identifier`, {
      params: {
        application: "AgriSearch",
        email: "agrisearch@replit.app"
      },
      timeout: 10000
    });
    
    cachedAppIdentifier = response.data.encoded_app_identifier;
    console.log("HDX App Identifier obtained:", cachedAppIdentifier);
    return cachedAppIdentifier as string;
  } catch (error: any) {
    console.error("Failed to get HDX app identifier:", error.message);
    return "QWdyaVNlYXJjaDphZ3Jpc2VhcmNoQHJlcGxpdC5hcHA=";
  }
}

export async function fetchFromFEWSNET(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    const country = params.country || "Kenya";
    const commodity = params.crop || "maize";
    const appId = await getAppIdentifier();
    
    const apiParams: any = {
      app_identifier: appId,
      location_name: country,
      output_format: "json",
      limit: 100
    };
    
    if (params.dateRange?.start) {
      apiParams.reference_period_start_min = params.dateRange.start;
    }
    if (params.dateRange?.end) {
      apiParams.reference_period_end_max = params.dateRange.end;
    }
    
    const response = await axios.get(`${HDX_HAPI_BASE}/food/food-price`, {
      params: apiParams,
      timeout: 45000,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    let priceData = response.data?.data || [];
    
    if (commodity && priceData.length > 0) {
      const filtered = priceData.filter((record: any) => 
        record.commodity_name?.toLowerCase().includes(commodity.toLowerCase())
      );
      if (filtered.length > 0) {
        priceData = filtered;
      }
    }

    if (priceData.length > 0) {
      const sortedData = priceData.sort((a: any, b: any) => 
        new Date(b.reference_period_start).getTime() - new Date(a.reference_period_start).getTime()
      );
      
      const mostRecentRecord = sortedData[0];
      const mostRecentDate = mostRecentRecord.reference_period_start;
      
      const currentPriceRecords = sortedData.filter((record: any) => 
        record.reference_period_start === mostRecentDate
      );
      
      const priceRecords = sortedData.map((record: any) => ({
        crop: record.commodity_name || commodity,
        country: record.location_name || country,
        market: record.market_name || "National",
        region: record.admin1_name || "",
        price: record.price || 0,
        unit: record.unit || "kg",
        currency: record.currency_code || "USD",
        date: record.reference_period_start || new Date().toISOString().split('T')[0],
        source: "HDX HAPI"
      }));

      const latestPrice = priceRecords[0];
      const avgPrice = currentPriceRecords.reduce((sum: number, r: any) => sum + (r.price || 0), 0) / currentPriceRecords.length;

      return {
        source: "HDX HAPI",
        data: {
          crop: latestPrice.crop,
          country: latestPrice.country,
          market: latestPrice.market,
          region: latestPrice.region,
          currentPrice: latestPrice.price,
          averagePrice: Math.round(avgPrice * 100) / 100,
          unit: latestPrice.unit,
          currency: latestPrice.currency,
          lastUpdated: latestPrice.date,
          priceHistory: priceRecords.slice(0, 6),
          recordCount: priceRecords.length,
          dataNote: params.dateRange?.start ? `Data for period: ${params.dateRange.start}` : "Most recent available data"
        },
        timestamp: new Date()
      };
    }

    return {
      source: "FEWS NET",
      data: {
        crop: commodity,
        country: country,
        message: "No price data available for the specified parameters",
        currentPrice: null
      },
      timestamp: new Date()
    };
  } catch (error: any) {
    console.error("FEWS NET API error:", error.message);
    return {
      source: "FEWS NET",
      data: {
        crop: params.crop || "unknown",
        country: params.country || "unknown",
        error: "Unable to fetch data from FEWS NET",
        message: error.message
      },
      timestamp: new Date()
    };
  }
}

export async function fetchFromHDXFoodSecurity(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    const country = params.country || "Kenya";
    const appId = await getAppIdentifier();
    
    const response = await axios.get(`${HDX_HAPI_BASE}/food/food-security`, {
      params: {
        app_identifier: appId,
        location_name: country,
        output_format: "json",
        limit: 10
      },
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const securityData = response.data.data[0];
      
      return {
        source: "HDX Food Security",
        data: {
          country: securityData.location_name || country,
          ipcPhase: securityData.ipc_phase || "Unknown",
          populationInNeed: securityData.population_in_need || 0,
          populationFraction: securityData.population_fraction_in_need || 0,
          referenceDate: securityData.reference_period_start || new Date().toISOString().split('T')[0],
          dataSource: "Humanitarian Data Exchange"
        },
        timestamp: new Date()
      };
    }

    return {
      source: "HDX Food Security",
      data: {
        country: country,
        message: "No food security data available"
      },
      timestamp: new Date()
    };
  } catch (error: any) {
    console.error("HDX Food Security API error:", error.message);
    return null;
  }
}

export async function fetchFromHDXPopulation(params: ExtractedParams): Promise<ExternalApiResult | null> {
  try {
    const country = params.country || "Kenya";
    const appId = await getAppIdentifier();
    
    const response = await axios.get(`${HDX_HAPI_BASE}/population-social/population`, {
      params: {
        app_identifier: appId,
        location_name: country,
        output_format: "json",
        limit: 5
      },
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const popData = response.data.data[0];
      
      return {
        source: "HDX Population",
        data: {
          country: popData.location_name || country,
          population: popData.population || 0,
          gender: popData.gender || "all",
          ageRange: popData.age_range || "all",
          referenceDate: popData.reference_period_start || new Date().toISOString().split('T')[0]
        },
        timestamp: new Date()
      };
    }

    return null;
  } catch (error: any) {
    console.error("HDX Population API error:", error.message);
    return null;
  }
}

export async function fetchAgricultureData(params: ExtractedParams): Promise<ExternalApiResult[]> {
  const results = await Promise.allSettled([
    fetchFromFEWSNET(params),
    fetchFromHDXFoodSecurity(params),
    fetchFromHDXPopulation(params)
  ]);

  const successfulResults: ExternalApiResult[] = [];
  
  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      successfulResults.push(result.value);
    }
  }

  return successfulResults;
}
