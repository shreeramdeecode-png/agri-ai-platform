import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { X, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHistory } from "@shared/schema";

type HistoryFilter = "all" | "recent";

function groupSearchesByTime(searches: SearchHistory[], mode: HistoryFilter) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups = {
    today: [] as SearchHistory[],
    yesterday: [] as SearchHistory[],
    thisWeek: [] as SearchHistory[],
    older: [] as SearchHistory[],
  };

  searches.forEach((search) => {
    const searchDate = new Date(search.createdAt);
    if (searchDate >= today) {
      groups.today.push(search);
    } else if (searchDate >= yesterday) {
      groups.yesterday.push(search);
    } else if (searchDate >= weekStart) {
      groups.thisWeek.push(search);
    } else if (mode === "all") {
      groups.older.push(search);
    }
  });

  return groups;
}

function filterByMode(history: SearchHistory[], mode: HistoryFilter): SearchHistory[] {
  if (mode === "all") return history;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 7);
  return history.filter((h) => new Date(h.createdAt) >= weekStart);
}

export default function HistoryPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<HistoryFilter>("recent");
  const { data: history, isLoading } = useQuery<SearchHistory[]>({
    queryKey: ["/api/search/history"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/search/history/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/search/history"] });
      toast({ title: "Deleted", description: "History entry removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/search/history/clear-all", { method: "POST" });
    },
    onSuccess: async (data: { deleted?: number } | null) => {
      const hadItems = (history?.length ?? 0) > 0;
      const deleted = data?.deleted ?? 0;

      if (hadItems && deleted === 0) {
        toast({
          title: "Could not clear history",
          description: "Nothing was removed. Restart the dev server and try again.",
          variant: "destructive",
        });
        await queryClient.refetchQueries({ queryKey: ["/api/search/history"] });
        return;
      }

      queryClient.setQueryData<SearchHistory[]>(["/api/search/history"], []);
      await queryClient.refetchQueries({ queryKey: ["/api/search/history"] });
      toast({ title: "Cleared", description: "All search history removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredHistory = useMemo(
    () => filterByMode(history || [], filter),
    [history, filter]
  );

  const groups = useMemo(
    () => groupSearchesByTime(filteredHistory, filter),
    [filteredHistory, filter]
  );

  const hasAnyItems =
    groups.today.length > 0 ||
    groups.yesterday.length > 0 ||
    groups.thisWeek.length > 0 ||
    groups.older.length > 0;

  if (isLoading) return <div className="p-8 text-white">Loading history...</div>;

  const handleContinueChat = (item: SearchHistory) => {
    localStorage.setItem("activeConversation", JSON.stringify(item));
    setLocation("/search");
  };

  const renderSearchItem = (item: SearchHistory) => (
    <Card
      key={item.id}
      className="bg-[#2a3749] border-[#3a4759] p-3 md:p-5 hover:border-emerald-500/50 transition-colors cursor-pointer"
      data-testid={`history-${item.id}`}
      onClick={() => handleContinueChat(item)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <h3
              className="font-semibold text-white text-sm md:text-base truncate"
              data-testid={`text-query-${item.id}`}
            >
              {item.query}
            </h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-2 md:mb-3 line-clamp-2">
            {(item.results as { answer?: string })?.answer?.substring(0, 100) || "No answer available"}
            …
          </p>
          <div className="flex flex-wrap gap-2 md:gap-4 text-[10px] md:text-xs text-gray-500">
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            <span className="hidden sm:inline">• {item.sourceType || "API"}</span>
            <span className="text-emerald-400">• Continue</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            deleteMutation.mutate(item.id);
          }}
          className="text-gray-400 hover:text-red-400 transition-colors p-1 md:p-2 flex-shrink-0"
          data-testid={`button-delete-${item.id}`}
        >
          <X className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </Card>
  );

  const filterButtonClass = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded-md text-xs md:text-sm font-medium border transition-colors",
      active
        ? "bg-[#3a4759] text-white border-[#4a5769]"
        : "bg-transparent text-gray-400 border-transparent hover:bg-[#3a4759]/80 hover:text-gray-100"
    );

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-0">
      <Card className="bg-[#2a3749] border-[#3a4759] p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 md:mb-6 gap-3">
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2"
              data-testid="heading-history"
            >
              Search History
            </h1>
            <p className="text-sm md:text-base text-gray-400">Your recent searches and results</p>
          </div>
          <Button
            type="button"
            className="bg-red-500 hover:bg-red-600 text-white text-sm shrink-0"
            data-testid="button-clear-all"
            disabled={!history?.length || clearAllMutation.isPending}
            onClick={() => {
              if (window.confirm("Delete all search history? This cannot be undone.")) {
                clearAllMutation.mutate();
              }
            }}
          >
            {clearAllMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing…
              </>
            ) : (
              "Clear All"
            )}
          </Button>
        </div>

        <div className="flex gap-2 md:gap-3 mb-6 md:mb-8" role="tablist" aria-label="History time range">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={filterButtonClass(filter === "all")}
            onClick={() => setFilter("all")}
          >
            All Time
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "recent"}
            className={filterButtonClass(filter === "recent")}
            onClick={() => setFilter("recent")}
          >
            Recent
          </button>
        </div>

        {!hasAnyItems ? (
          <p className="text-gray-400 text-center py-8">
            {filter === "recent"
              ? "No searches in the last 7 days"
              : "No search history yet"}
          </p>
        ) : (
          <div className="space-y-8">
            {groups.today.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">Today</h2>
                <div className="space-y-3">{groups.today.map(renderSearchItem)}</div>
              </div>
            )}

            {groups.yesterday.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">Yesterday</h2>
                <div className="space-y-3">{groups.yesterday.map(renderSearchItem)}</div>
              </div>
            )}

            {groups.thisWeek.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">This Week</h2>
                <div className="space-y-3">{groups.thisWeek.map(renderSearchItem)}</div>
              </div>
            )}

            {filter === "all" && groups.older.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">Older</h2>
                <div className="space-y-3">{groups.older.map(renderSearchItem)}</div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
