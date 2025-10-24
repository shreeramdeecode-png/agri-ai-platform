import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, Bell, Settings } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/admin");
  };

  const menuItems = [
    { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/users", label: "User Management", icon: Users },
    { path: "/admin/notifications", label: "Notifications", icon: Bell },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (path: string) => location === path;

  return (
    <div className="flex h-screen bg-[#1f2544]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#2d3250] border-r border-[#424769] flex flex-col">
        {/* Logo/Branding */}
        <div className="p-6 border-b border-[#424769]">
          <h1 className="text-xl font-bold text-white">AI Search</h1>
          <p className="text-sm text-gray-400">Admin Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                data-testid={`link-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    isActive(item.path)
                      ? "bg-gradient-to-r from-[#f87171] to-[#fb923c] text-white"
                      : "text-gray-300 hover:bg-[#424769] hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-[#424769]">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:bg-[#424769] hover:text-white"
            data-testid="button-logout"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
