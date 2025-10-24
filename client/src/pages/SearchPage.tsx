import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, FileText, Database, Image as ImageIcon } from "lucide-react";

export default function SearchPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      return apiRequest("/api/search/query", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery }),
      });
    },
    onSuccess: (data: any) => {
      setSearchResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
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

  const getSourceIcon = (source: string) => {
    if (source.includes("API")) return <Database className="h-4 w-4" />;
    if (source.includes("PDF")) return <FileText className="h-4 w-4" />;
    if (source.includes("Image")) return <ImageIcon className="h-4 w-4" />;
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-search">Agriculture Search</h1>
        <p className="text-muted-foreground">Ask questions about agriculture, climate, and market data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Natural Language Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <Textarea
              data-testid="input-search-query"
              placeholder="e.g., What is the wheat production in Kenya for 2023?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button
              type="submit"
              disabled={searchMutation.isPending || !query.trim()}
              data-testid="button-search"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searchResult && (
        <Card data-testid="search-result">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Search Results</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getSourceIcon(searchResult.sourceType)}
                <span>Source: {searchResult.sourceType}</span>
                <span>• {searchResult.executionTime}ms</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Answer</h3>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-answer">{searchResult.answer}</p>
            </div>

            {searchResult.extractedParams && (
              <div>
                <h3 className="font-semibold mb-2">Extracted Parameters</h3>
                <div className="text-sm space-y-1">
                  {searchResult.extractedParams.crop && (
                    <p>Crop: {searchResult.extractedParams.crop}</p>
                  )}
                  {searchResult.extractedParams.country && (
                    <p>Country: {searchResult.extractedParams.country}</p>
                  )}
                  {searchResult.extractedParams.region && (
                    <p>Region: {searchResult.extractedParams.region}</p>
                  )}
                </div>
              </div>
            )}

            {searchResult.apiResults && searchResult.apiResults.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">API Data Sources</h3>
                <div className="space-y-2">
                  {searchResult.apiResults.map((result: any, idx: number) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{result.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
