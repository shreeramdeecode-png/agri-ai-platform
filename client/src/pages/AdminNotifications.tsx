import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Notification } from "@shared/schema";

export default function AdminNotifications() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "today">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/notifications/clear", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      toast({ title: "Success", description: "All notifications cleared" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/notifications/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      toast({ title: "Success", description: "Notification deleted" });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-white">Loading notifications...</div>;
  }

  const allNotifications = notifications || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filteredNotifications = allNotifications.filter((n: any) => {
    const matchesTime = filter === "all" || new Date(n.createdAt) >= today;
    const matchesType = typeFilter === "all" || n.type === typeFilter;
    return matchesTime && matchesType;
  });

  const registrationCount = allNotifications.filter((n: any) => n.type === "registration").length;
  const systemAlertCount = allNotifications.filter((n: any) => n.type === "error" || n.type === "warning").length;
  const totalCount = allNotifications.length;

  const getNotificationStyle = (type: string) => {
    const styles: Record<string, { border: string; bg: string; icon: string; iconBg: string }> = {
      registration: {
        border: "border-emerald-500/50",
        bg: "bg-emerald-500/10",
        icon: "text-emerald-400",
        iconBg: "bg-emerald-500",
      },
      error: {
        border: "border-red-500/50",
        bg: "bg-red-500/10",
        icon: "text-red-400",
        iconBg: "bg-red-500",
      },
      update: {
        border: "border-blue-500/50",
        bg: "bg-blue-500/10",
        icon: "text-blue-400",
        iconBg: "bg-blue-500",
      },
      warning: {
        border: "border-orange-500/50",
        bg: "bg-orange-500/10",
        icon: "text-orange-400",
        iconBg: "bg-orange-500",
      },
      milestone: {
        border: "border-teal-500/50",
        bg: "bg-teal-500/10",
        icon: "text-teal-400",
        iconBg: "bg-teal-500",
      },
    };
    return styles[type] || styles.update;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-notifications">Notifications</h1>
          <p className="text-gray-400">System notifications and alerts</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#f87171] to-[#fb923c] flex items-center justify-center text-white font-bold">
          AD
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#2d3250] border-[#424769]" data-testid="card-new-registrations">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-400 text-sm font-medium">New Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{registrationCount}</div>
                <p className="text-xs text-emerald-400 mt-1">+{registrationCount > 0 ? 45 : 0}% from yesterday</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xl font-bold">
                {registrationCount}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d3250] border-[#424769]" data-testid="card-system-alerts">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-400 text-sm font-medium">System Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{systemAlertCount}</div>
                <p className="text-xs text-orange-400 mt-1">+{systemAlertCount > 0 ? 3 : 0} from last hour</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white text-xl font-bold">
                {systemAlertCount}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d3250] border-[#424769]" data-testid="card-total-notifications">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-400 text-sm font-medium">Total Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{totalCount}</div>
                <p className="text-xs text-blue-400 mt-1">+{totalCount > 0 ? 12 : 0}% from last week</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold">
                {totalCount}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            onClick={() => setTypeFilter("all")}
            className={typeFilter === "all" ? "bg-[#424769] text-white border-[#424769]" : "bg-transparent border-[#424769] text-gray-300"}
            data-testid="filter-all-types"
          >
            All Types
          </Button>
          <Button
            variant={filter === "today" ? "default" : "outline"}
            onClick={() => setFilter("today")}
            className={filter === "today" ? "bg-[#424769] text-white border-[#424769]" : "bg-transparent border-[#424769] text-gray-300"}
            data-testid="filter-today"
          >
            Today
          </Button>
        </div>
        <Button
          onClick={() => clearAllMutation.mutate()}
          className="bg-gradient-to-r from-[#f87171] to-[#fb923c] text-white hover:opacity-90"
          data-testid="button-clear-all"
        >
          Clear All
        </Button>
      </div>

      {/* Notifications List */}
      <Card className="bg-[#2d3250] border-[#424769]">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {filteredNotifications.length === 0 && (
              <p className="text-gray-400 text-center py-8">No notifications to display</p>
            )}
            {filteredNotifications.map((notification: any) => {
              const style = getNotificationStyle(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 ${style.border} ${style.bg}`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className={`w-10 h-10 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <div className={`w-3 h-3 rounded-full bg-white`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${style.icon} mb-1`}>{notification.title}</h3>
                    <p className="text-sm text-gray-300 mb-2">{notification.message}</p>
                    <p className="text-xs text-gray-400">{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteNotificationMutation.mutate(notification.id)}
                    className="text-gray-400 hover:text-white hover:bg-[#424769]"
                    data-testid={`button-delete-notification-${notification.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
