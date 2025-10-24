import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Search, FileText, Image, History, User } from "lucide-react";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/");
  };

  const menuItems = [
    { path: "/search", label: "Search", icon: Search },
    { path: "/documents", label: "Documents", icon: FileText },
    { path: "/images", label: "Images", icon: Image },
    { path: "/history", label: "History", icon: History },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-emerald-600">AgriSearch</h1>
              <nav className="hidden md:flex gap-6">
                {menuItems.map((item) => (
                  <Link key={item.path} href={item.path}>
                    <a
                      className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-emerald-600 ${
                        location === item.path ? "text-emerald-600" : "text-gray-600"
                      }`}
                      data-testid={`link-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </a>
                  </Link>
                ))}
              </nav>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
