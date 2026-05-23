import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogs() {
  const { data: searchLogs, isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/search-history"],
  });
  const { data: adminLogs, isLoading: adminLogsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/logs"],
  });

  if (logsLoading || adminLogsLoading) return <div className="p-8">Loading logs...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-logs">System Logs</h1>
        <p className="text-muted-foreground">View search history and admin actions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {searchLogs?.slice(0, 20).map((log: any) => (
              <div key={log.id} className="p-3 border rounded-lg" data-testid={`search-log-${log.id}`}>
                <p className="font-medium text-sm">{log.query}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Source: {log.sourceType}</span>
                  <span>Agent: {log.agentUsed}</span>
                  <span>Time: {log.executionTime}ms</span>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {adminLogs?.slice(0, 20).map((log: any) => (
              <div key={log.id} className="p-3 border rounded-lg" data-testid={`admin-log-${log.id}`}>
                <p className="font-medium text-sm capitalize">{log.action.replace(/_/g, " ")}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Entity: {log.targetEntity}</span>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
