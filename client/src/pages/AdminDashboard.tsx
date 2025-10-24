import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Zap, Activity, Download, Settings as SettingsIcon, Bell, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AdminLog } from "@shared/schema";

interface DashboardStats {
  totalUsers: number;
  queriesToday: number;
  apiQueries: number;
  activeSessions: number;
}

interface AnalyticsData {
  name: string;
  queries: number;
  api: number;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard"],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData[]>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: recentLogs } = useQuery<AdminLog[]>({
    queryKey: ["/api/admin/logs"],
  });

  if (statsLoading || analyticsLoading) {
    return <div className="p-8 text-white">Loading dashboard...</div>;
  }

  const chartData = analytics || [];

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      change: "+13% from last week",
      icon: Users,
      gradient: "from-[#f87171] to-[#fb923c]",
      testId: "stat-total-users",
    },
    {
      title: "Queries Today",
      value: stats?.queriesToday || 0,
      change: "+25% from yesterday",
      icon: Search,
      gradient: "from-[#14b8a6] to-[#0d9488]",
      testId: "stat-queries-today",
    },
    {
      title: "API Calls",
      value: stats?.apiQueries || 0,
      change: "+8% from last hour",
      icon: Zap,
      gradient: "from-[#60a5fa] to-[#3b82f6]",
      testId: "stat-api-calls",
    },
    {
      title: "Active Sessions",
      value: stats?.activeSessions || 0,
      change: "Real-time activity",
      icon: Activity,
      gradient: "from-[#fbbf24] to-[#f59e0b]",
      testId: "stat-active-sessions",
    },
  ];

  const quickActions = [
    { label: "Export Logs", icon: Download, color: "from-[#f87171] to-[#fb923c]" },
    { label: "Manage APIs", icon: SettingsIcon, color: "from-[#14b8a6] to-[#0d9488]" },
    { label: "Send Alerts", icon: Bell, color: "from-[#60a5fa] to-[#3b82f6]" },
    { label: "View Reports", icon: FileBarChart, color: "from-[#fbbf24] to-[#f59e0b]" },
  ];

  const recentActivity = recentLogs?.slice(0, 4) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-dashboard">Dashboard Overview</h1>
          <p className="text-gray-400">Real-time analytics and system monitoring</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#f87171] to-[#fb923c] flex items-center justify-center text-white font-bold">
          AD
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="bg-[#2d3250] border-[#424769] overflow-hidden"
              data-testid={stat.testId}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-400 text-sm font-medium">{stat.title}</CardTitle>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-1">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-gray-400">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Analytics Chart */}
        <Card className="bg-[#2d3250] border-[#424769] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Query Analytics</CardTitle>
            <CardDescription className="text-gray-400">Last 7 days performance</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#424769" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2d3250", border: "1px solid #424769", color: "#fff" }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Line type="monotone" dataKey="queries" stroke="#f87171" strokeWidth={2} name="Total Queries" />
                  <Line type="monotone" dataKey="api" stroke="#60a5fa" strokeWidth={2} name="API Queries" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-gray-400">No analytics data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-[#2d3250] border-[#424769]">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-gray-400">Live system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 && (
                <p className="text-gray-400 text-sm">No recent activity</p>
              )}
              {recentActivity.map((log: any, index: number) => {
                const colors = [
                  { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
                  { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-500" },
                  { bg: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-500" },
                  { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
                ];
                const color = colors[index % colors.length];
                
                return (
                  <div key={log.id} className={`flex items-start gap-3 p-3 rounded-lg ${color.bg}`}>
                    <div className={`w-2 h-2 rounded-full ${color.dot} mt-2 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${color.text} truncate`}>
                        {log.action?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-[#2d3250] border-[#424769]">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  className={`bg-gradient-to-r ${action.color} hover:opacity-90 text-white border-0`}
                  data-testid={`button-${action.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center gap-2 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium">All Systems Online</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
