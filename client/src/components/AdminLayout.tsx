import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, FileText, Activity, Settings } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/admin");
  };

  const menuItems = [
    { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/documents", label: "Documents", icon: FileText },
    { path: "/admin/logs", label: "Logs", icon: Activity },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-slate-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-slate-400">AgriSearch</p>
        </div>
        <nav className="space-y-1 px-3">
          {menuItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors ${
                  location === item.path ? "bg-slate-800" : ""
                }`}
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </a>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-64 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-slate-800"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
