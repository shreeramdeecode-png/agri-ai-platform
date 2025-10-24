import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

export default function HistoryPage() {
  const { toast } = useToast();
  const { data: history, isLoading } = useQuery({ queryKey: ["/api/search/history"] });

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

  const renderSearchItem = (item: any) => (
    <Card
      key={item.id}
      className="bg-[#2a3749] border-[#3a4759] p-5 hover:border-emerald-500/50 transition-colors"
      data-testid={`history-${item.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <h3 className="font-semibold text-white" data-testid={`text-query-${item.id}`}>
              {item.query}
            </h3>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            {item.results?.answer?.substring(0, 150) || "No answer available"}
          </p>
          <div className="flex gap-4 text-xs text-gray-500">
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            <span>• {item.sourceType || "API"}</span>
            <span>• {item.agentUsed || "Search Agent"}</span>
          </div>
        </div>
        <button
          onClick={() => deleteMutation.mutate(item.id)}
          className="text-gray-400 hover:text-red-400 transition-colors p-2"
          data-testid={`button-delete-${item.id}`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </Card>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card className="bg-[#2a3749] border-[#3a4759] p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-history">
              Search History
            </h1>
            <p className="text-gray-400">Your recent searches and results</p>
          </div>
          <Button 
            className="bg-red-500 hover:bg-red-600 text-white"
            data-testid="button-clear-all"
          >
            Clear All
          </Button>
        </div>

        <div className="flex gap-3 mb-8">
          <Button variant="secondary" size="sm" className="bg-[#3a4759] text-white hover:bg-[#4a5769]">
            All Time
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
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
