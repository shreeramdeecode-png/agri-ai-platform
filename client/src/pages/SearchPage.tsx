import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mic, TrendingUp, Cloud, BarChart2 } from "lucide-react";
import { useLocation } from "wouter";
import type { SearchHistory } from "@shared/schema";

export default function SearchPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  const { data: recentSearches, isLoading } = useQuery<SearchHistory[]>({ 
    queryKey: ["/api/search/history"],
  });

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      return apiRequest("/api/search/query", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
      setLocation("/search/results");
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMutation.mutate(query);
    }
  };

  const popularSearches = [
    {
      title: "🌾 Crop Prices",
      description: "Current market prices for major crops worldwide",
      icon: TrendingUp,
    },
    {
      title: "🌤️ Weather Data",
      description: "Rainfall and climate information by region",
      icon: Cloud,
    },
    {
      title: "📈 Market Trends",
      description: "Historical data and market analysis",
      icon: BarChart2,
    },
  ];

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 2) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4 pt-12">
        <h1 className="text-4xl font-bold text-white" data-testid="heading-search">
          What would you like to know?
        </h1>
        <p className="text-gray-400 text-lg">
          Ask anything about agriculture, climate, or market data in natural language
        </p>
      </div>

      <Card className="bg-[#2a3749] border-[#3a4759] p-8 shadow-2xl">
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="relative">
            <Input
              data-testid="input-search-query"
              placeholder='e.g., "What is the current maize price in Kenya?" or "Show me rainfall data for Nigeria"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-white text-gray-900 border-0 h-14 text-base pr-14 placeholder:text-gray-500"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-emerald-600"
              data-testid="button-voice-search"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Voice Search</span>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-12"
            disabled={searchMutation.isPending}
            data-testid="button-search"
          >
            {searchMutation.isPending ? "Searching..." : "Search"}
          </Button>
        </form>
      </Card>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">Popular Searches</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {popularSearches.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                className="bg-[#2a3749] border-[#3a4759] p-6 hover:border-emerald-500/50 transition-colors cursor-pointer"
                onClick={() => {
                  setQuery(item.description);
                }}
                data-testid={`card-popular-${item.title}`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {!isLoading && recentSearches && recentSearches.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Recent Searches</h2>
          <div className="space-y-3">
            {recentSearches.slice(0, 5).map((search: any) => (
              <div
                key={search.id}
                className="flex items-center justify-between bg-[#2a3749] border border-[#3a4759] rounded-lg px-4 py-3 hover:border-emerald-500/50 transition-colors cursor-pointer"
                onClick={() => setQuery(search.query)}
                data-testid={`recent-search-${search.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-white">{search.query}</span>
                </div>
                <span className="text-sm text-gray-400">
                  {getTimeAgo(search.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
