import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Download, Share2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function SearchResults() {
  const { data: history } = useQuery({ 
    queryKey: ["/api/search/history"],
  });

  const latestSearch = history?.[0];
  const searchQuery = latestSearch?.query || "What is the current maize price in Kenya?";

  const priceData = [
    { month: "Jan", price: 210 },
    { month: "Mar", price: 220 },
    { month: "May", price: 235 },
    { month: "Jul", price: 245 },
  ];

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
          Found 3 data sources • Searched in 2.3 seconds
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
                  <h3 className="text-xl font-bold text-gray-900">Maize Prices - Kenya</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Source: FAOSTAT • Updated: 2 hours ago • Confidence: 98%
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
                <p className="text-3xl font-bold text-emerald-600">$245</p>
                <p className="text-xs text-gray-500">per metric ton</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Monthly Change</p>
                <p className="text-3xl font-bold text-yellow-600">+12%</p>
                <p className="text-xs text-gray-500">vs last month</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Market Status</p>
                <p className="text-3xl font-bold text-blue-600">High</p>
                <p className="text-xs text-gray-500">Above average</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Price Trend (Last 6 Months)</h4>
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
          </Card>

          <Card className="bg-[#2a3749] border-[#3a4759] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🌱</span>
              <h3 className="text-lg font-semibold text-white">Alternative Crops - Kenya</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Source: HDX • Updated: 1 day ago
            </p>
            <div className="space-y-2 text-white">
              <p>Wheat: $280/ton • Rice: $420/ton • Sorghum: $195/ton</p>
              <p className="text-sm text-gray-400">Compare with maize pricing trends</p>
            </div>
            <Button variant="outline" className="mt-4 text-emerald-400 border-emerald-400 hover:bg-emerald-500/10" data-testid="button-view-details">
              View Details
            </Button>
          </Card>

          <Card className="bg-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📊</span>
                  <h3 className="text-lg font-semibold text-gray-900">Historical Price Data - Kenya Maize</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Source: FAOSTAT • Complete dataset available
                </p>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-download">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">$198</p>
                <p className="text-sm text-gray-600">Avg 2023</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">$312</p>
                <p className="text-sm text-gray-600">Peak 2024</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">$165</p>
                <p className="text-sm text-gray-600">Low 2023</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-teal-50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🌍</span>
              <h3 className="text-lg font-semibold text-gray-900">Related Climate Data</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Source: CHIRPS • Updated: 4 hours ago
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Rainfall:</p>
                <p className="text-lg font-semibold text-teal-700">145mm</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Temperature:</p>
                <p className="text-lg font-semibold text-teal-700">24°C avg</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Conditions:</p>
                <p className="text-sm text-teal-700">Favorable for crops</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📝</span>
              <h3 className="text-lg font-semibold text-gray-900">Market Insights</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              AI Analysis • Confidence: 94%
            </p>
            <p className="text-sm text-gray-800 leading-relaxed">
              Price increase driven by seasonal demand and reduced supply. 
              Bullish trend expected due to supply constraints.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
