import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LogOut, LayoutDashboard, Users, Bell, Settings, Menu } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <nav className="flex-1 px-3 py-4 md:py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`link-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              onClick={onNavigate}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                  isActive(item.path)
                    ? "bg-gradient-to-r from-[#f87171] to-[#fb923c] text-white"
                    : "text-gray-300 hover:bg-[#424769] hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[#424769]">
        <Button
          onClick={() => {
            onNavigate?.();
            handleLogout();
          }}
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:bg-[#424769] hover:text-white"
          data-testid="button-logout"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] min-h-screen bg-[#1f2544]">
      <aside className="hidden md:flex w-64 bg-[#2d3250] border-r border-[#424769] flex-col shrink-0">
        <div className="p-6 border-b border-[#424769]">
          <h1 className="text-xl font-bold text-white">AI Search</h1>
          <p className="text-sm text-gray-400">Admin Panel</p>
        </div>
        <NavLinks />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw,20rem)] bg-[#2d3250] border-[#424769] text-white p-0 flex flex-col"
        >
          <SheetHeader className="p-6 border-b border-[#424769] text-left">
            <SheetTitle className="text-white text-xl">AI Search Admin</SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="md:hidden shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[#424769] bg-[#2d3250] safe-area-top">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-[#424769] shrink-0"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400">Admin Panel</p>
            <p className="text-sm font-medium text-white truncate">
              {menuItems.find((m) => isActive(m.path))?.label ?? "Admin"}
            </p>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
