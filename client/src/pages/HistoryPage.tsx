import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Clock } from "lucide-react";

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

  if (isLoading) return <div className="p-8">Loading history...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-history">Search History</h1>
        <p className="text-muted-foreground">View your past searches and results</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Searches</CardTitle>
        </CardHeader>
        <CardContent>
          {history?.length === 0 ? (
            <p className="text-muted-foreground">No search history yet</p>
          ) : (
            <div className="space-y-4">
              {history?.map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg"
                  data-testid={`history-${item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium" data-testid={`text-query-${item.id}`}>{item.query}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <span>Source: {item.sourceType}</span>
                        <span>Agent: {item.agentUsed}</span>
                        <span>{item.executionTime}ms</span>
                      </div>
                      {item.results?.answer && (
                        <div className="mt-3 p-3 bg-muted rounded text-sm">
                          <p className="font-medium mb-1">Answer:</p>
                          <p className="text-xs line-clamp-3">{item.results.answer}</p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
