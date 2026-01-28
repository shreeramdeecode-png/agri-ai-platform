import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { X, MessageSquare } from "lucide-react";
import type { SearchHistory } from "@shared/schema";

export default function HistoryPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: history, isLoading } = useQuery<SearchHistory[]>({ queryKey: ["/api/search/history"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/search/history/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
      toast({ title: "Success", description: "History entry deleted" });
    },
  });

  const groupSearchesByTime = (searches: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = {
      today: [] as any[],
      yesterday: [] as any[],
      thisWeek: [] as any[],
    };

    searches?.forEach((search) => {
      const searchDate = new Date(search.createdAt);
      if (searchDate >= today) {
        groups.today.push(search);
      } else if (searchDate >= yesterday) {
        groups.yesterday.push(search);
      } else if (searchDate >= thisWeek) {
        groups.thisWeek.push(search);
      }
    });

    return groups;
  };

  const groups = groupSearchesByTime(history || []);

  if (isLoading) return <div className="p-8 text-white">Loading history...</div>;

  const handleContinueChat = (item: any) => {
    localStorage.setItem("activeConversation", JSON.stringify(item));
    setLocation("/search");
  };

  const renderSearchItem = (item: any) => (
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
            <h3 className="font-semibold text-white text-sm md:text-base truncate" data-testid={`text-query-${item.id}`}>
              {item.query}
            </h3>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-2 md:mb-3 line-clamp-2">
            {item.results?.answer?.substring(0, 100) || "No answer available"}...
          </p>
          <div className="flex flex-wrap gap-2 md:gap-4 text-[10px] md:text-xs text-gray-500">
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            <span className="hidden sm:inline">• {item.sourceType || "API"}</span>
            <span className="text-emerald-400">• Continue</span>
          </div>
        </div>
        <button
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

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-0">
      <Card className="bg-[#2a3749] border-[#3a4759] p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 md:mb-6 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2" data-testid="heading-history">
              Search History
            </h1>
            <p className="text-sm md:text-base text-gray-400">Your recent searches and results</p>
          </div>
          <Button 
            className="bg-red-500 hover:bg-red-600 text-white text-sm"
            data-testid="button-clear-all"
          >
            Clear All
          </Button>
        </div>

        <div className="flex gap-2 md:gap-3 mb-6 md:mb-8">
          <Button variant="secondary" size="sm" className="bg-[#3a4759] text-white hover:bg-[#4a5769] text-xs md:text-sm">
            All Time
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs md:text-sm">
            Recent
          </Button>
        </div>

        {history?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No search history yet</p>
        ) : (
          <div className="space-y-8">
            {groups.today.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">Today</h2>
                <div className="space-y-3">
                  {groups.today.map(renderSearchItem)}
                </div>
              </div>
            )}

            {groups.yesterday.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">Yesterday</h2>
                <div className="space-y-3">
                  {groups.yesterday.map(renderSearchItem)}
                </div>
              </div>
            )}

            {groups.thisWeek.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-emerald-400">This Week</h2>
                <div className="space-y-3">
                  {groups.thisWeek.map(renderSearchItem)}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
