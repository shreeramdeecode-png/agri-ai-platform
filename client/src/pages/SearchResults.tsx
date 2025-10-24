import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Download, Share2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { SearchHistory } from "@shared/schema";

export default function SearchResults() {
  const { data: history, isLoading } = useQuery<SearchHistory[]>({ 
    queryKey: ["/api/search/history"],
  });

  if (isLoading) {
    return <div className="p-8 text-white">Loading search results...</div>;
  }

  const latestSearch = history?.[0];
  const searchQuery = latestSearch?.query || "No search query";
  const results = latestSearch?.results as any;
  const answer = results?.answer || "";
  const apiResults = results?.apiResults || [];
  const executionTime = latestSearch?.executionTime || 0;
  const sourceCount = [
    apiResults.length > 0 ? "API" : null,
    results?.pdfResults?.length > 0 ? "PDF" : null,
    results?.imageResults?.length > 0 ? "Image" : null,
  ].filter(Boolean).length;

  // Extract price data from apiResults for chart
  const priceData = apiResults.length > 0 && apiResults[0]?.data?.prices 
    ? apiResults[0].data.prices.map((item: any) => ({
        month: item.month || item.year || item.period || "N/A",
        price: item.value || item.price || 0,
      }))
    : [];

  // Extract current price, change %, and market status from first API result
  const firstApiData = apiResults[0]?.data || {};
  const currentPrice = firstApiData.currentPrice || firstApiData.price || "N/A";
  const priceChange = firstApiData.change || firstApiData.percentChange || "N/A";
  const marketStatus = firstApiData.status || firstApiData.trend || "N/A";
  const commodity = firstApiData.commodity || firstApiData.item || "Agriculture Data";
  const country = firstApiData.country || firstApiData.region || "";
  const source = apiResults[0]?.source || "API";

  // Show no data message if no results
  if (!latestSearch || apiResults.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Input
            value={searchQuery}
            readOnly
            className="flex-1 bg-[#2a3749] border-[#3a4759] text-white h-12"
          />
          <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-white text-sm">JD</span>
          </div>
        </div>

        <Card className="bg-[#2d3250] border-[#424769] p-8 text-center">
          <p className="text-gray-400 text-lg">No data available</p>
          <p className="text-gray-500 text-sm mt-2">
            {latestSearch ? "No API results found for this query" : "No search history found"}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Input
          value={searchQuery}
          readOnly
          className="flex-1 bg-[#2a3749] border-[#3a4759] text-white h-12"
        />
        <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
          <span className="text-white text-sm">JD</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl text-white">
          Results for: <span className="font-semibold">"{searchQuery}"</span>
        </h2>
        <p className="text-sm text-gray-400">
          Found {sourceCount} data source{sourceCount !== 1 ? 's' : ''} • Searched in {(executionTime / 1000).toFixed(2)} seconds
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="bg-[#3a4759] text-white hover:bg-[#4a5769]">
          All Sources
        </Button>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
          Latest
        </Button>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
          Relevant
        </Button>
        <div className="flex-1"></div>
        <span className="text-sm text-gray-400">Sort by: Most Recent</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🌽</span>
                  <h3 className="text-xl font-bold text-gray-900">
                    {commodity} {country && `- ${country}`}
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  Source: {source} • Updated: Recently • Data from API
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" data-testid="button-export">
                  Export
                </Button>
                <Button size="sm" variant="outline" className="bg-white">
                  <Share2 className="w-4 h-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-emerald-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Current Price</p>
                <p className="text-3xl font-bold text-emerald-600" data-testid="text-current-price">
                  {typeof currentPrice === 'number' ? `$${currentPrice}` : currentPrice}
                </p>
                <p className="text-xs text-gray-500">per metric ton</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Change</p>
                <p className="text-3xl font-bold text-yellow-600" data-testid="text-price-change">
                  {typeof priceChange === 'number' ? `${priceChange > 0 ? '+' : ''}${priceChange}%` : priceChange}
                </p>
                <p className="text-xs text-gray-500">vs previous period</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Market Status</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="text-market-status">
                  {marketStatus}
                </p>
                <p className="text-xs text-gray-500">Trend indicator</p>
              </div>
            </div>

            {priceData.length > 0 ? (
              <div>
                <h4 className="font-semibold mb-4 text-gray-900">Price Trend</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={priceData}>
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: "#10b981", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No price trend data available</p>
              </div>
            )}
          </Card>

          {apiResults.length > 1 && (
            <Card className="bg-[#2a3749] border-[#3a4759] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🌱</span>
                <h3 className="text-lg font-semibold text-white">Additional Data</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Source: {apiResults[1]?.source} • From API
              </p>
              <div className="space-y-2 text-white">
                <p className="text-sm">
                  {JSON.stringify(apiResults[1]?.data).substring(0, 200)}...
                </p>
              </div>
              <Button variant="outline" className="mt-4 text-emerald-400 border-emerald-400 hover:bg-emerald-500/10" data-testid="button-view-details">
                View Details
              </Button>
            </Card>
          )}

          {results?.pdfResults && results.pdfResults.length > 0 && (
            <Card className="bg-gray-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📊</span>
                    <h3 className="text-lg font-semibold text-gray-900">Document Insights</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Source: User Documents • PDF Data
                  </p>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-download">
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>

              <div className="space-y-2">
                {results.pdfResults.slice(0, 3).map((pdf: any, idx: number) => (
                  <div key={idx} className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-800">{pdf.text?.substring(0, 150)}...</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {results?.imageResults && results.imageResults.length > 0 && (
            <Card className="bg-teal-50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🖼️</span>
                <h3 className="text-lg font-semibold text-gray-900">Image Analysis</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Source: User Images • AI Analyzed
              </p>
              <div className="space-y-3">
                {results.imageResults.slice(0, 3).map((img: string, idx: number) => (
                  <div key={idx} className="text-sm text-gray-700">
                    {img.substring(0, 100)}...
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="bg-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📝</span>
              <h3 className="text-lg font-semibold text-gray-900">AI-Generated Insights</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              AI Analysis • From Real Data
            </p>
            {answer ? (
              <p className="text-sm text-gray-800 leading-relaxed" data-testid="text-ai-insights">
                {answer}
              </p>
            ) : (
              <p className="text-sm text-gray-500">No AI insights available</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
