import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Search, MessageSquare, History, Upload, BarChart3, User, LogOut } from "lucide-react";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/");
  };

  const sidebarItems = [
    { path: "/search", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/history", label: "History", icon: History },
    { path: "/documents", label: "Upload", icon: Upload },
    { path: "/profile", label: "Analytics", icon: BarChart3 },
    { path: "/profile", label: "Settings", icon: User },
  ];

  const topNavItems = [
    { path: "/search", label: "Dashboard" },
    { path: "/history", label: "History" },
    { path: "/profile", label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-[#1a2332] flex">
      <aside className="w-20 bg-[#141d2b] flex flex-col items-center py-6 space-y-8 border-r border-[#2a3749]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col items-center gap-6 pt-8">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path + item.label} href={item.path}>
                <a
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? "text-emerald-400" : "text-gray-400 hover:text-emerald-400"
                  }`}
                  data-testid={`link-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-400 transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px]">Logout</span>
        </button>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-[#1a2332] border-b border-[#2a3749]">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </div>
              <span className="text-white font-semibold text-lg">AgriSearch</span>
            </div>

            <nav className="flex items-center gap-8">
              {topNavItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <a
                      className={`text-sm font-medium transition-colors ${
                        isActive ? "text-white" : "text-gray-400 hover:text-white"
                      }`}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                <span className="text-white text-sm">{user.email?.[0]?.toUpperCase() || "U"}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
