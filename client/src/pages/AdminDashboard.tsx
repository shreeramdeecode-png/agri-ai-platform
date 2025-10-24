import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, FileText, Image as ImageIcon } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/dashboard"],
  });

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  const cards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      description: "Registered users",
      testId: "stat-total-users",
    },
    {
      title: "Queries Today",
      value: stats?.queriesToday || 0,
      icon: Search,
      description: "Search queries made today",
      testId: "stat-queries-today",
    },
    {
      title: "API Queries",
      value: stats?.apiQueries || 0,
      icon: FileText,
      description: "Total API-based queries",
      testId: "stat-api-queries",
    },
    {
      title: "PDF Queries",
      value: stats?.pdfQueries || 0,
      icon: FileText,
      description: "Total PDF-based queries",
      testId: "stat-pdf-queries",
    },
    {
      title: "Image Queries",
      value: stats?.imageQueries || 0,
      icon: ImageIcon,
      description: "Total image-based queries",
      testId: "stat-image-queries",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={card.testId}>{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
