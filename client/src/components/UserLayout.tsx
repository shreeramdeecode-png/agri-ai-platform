import { Link, useLocation } from "wouter";
import { MessageSquarePlus, History, User, LogOut, FileText } from "lucide-react";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/");
  };

  const handleNewChat = () => {
    localStorage.removeItem("activeConversation");
    window.dispatchEvent(new CustomEvent("newChat"));
    setLocation("/search");
  };

  const sidebarItems = [
    { path: "/search", label: "New Chat", icon: MessageSquarePlus, onClick: handleNewChat },
    { path: "/history", label: "History", icon: History },
    { path: "/documents", label: "Documents", icon: FileText },
    { path: "/profile", label: "Settings", icon: User },
  ];

  const topNavItems = [
    { path: "/search", label: "Chat" },
    { path: "/history", label: "History" },
    { path: "/documents", label: "Documents" },
    { path: "/profile", label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-[#1a2332] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-20 bg-[#141d2b] flex-col items-center py-6 space-y-8 border-r border-[#2a3749]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col items-center gap-6 pt-8">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? "text-emerald-400" : "text-gray-400 hover:text-emerald-400"
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              );
            }
            
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
        {/* Mobile Header with Logo */}
        <header className="bg-[#1a2332] border-b border-[#2a3749]">
          <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4">
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-white font-semibold">AgriSearch</span>
            </div>
            <div className="hidden md:block" />

            <nav className="flex items-center gap-4 md:gap-8">
              {topNavItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <a
                      className={`text-xs md:text-sm font-medium transition-colors ${
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

        <main className="flex-1 p-4 md:p-8 overflow-y-auto scrollbar-hide">{children}</main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#141d2b] border-t border-[#2a3749] flex justify-around py-3">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? "text-emerald-400" : "text-gray-400"
                  }`}
                  data-testid={`mobile-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              );
            }
            
            return (
              <Link key={item.path + item.label} href={item.path}>
                <a
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? "text-emerald-400" : "text-gray-400"
                  }`}
                  data-testid={`mobile-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.label}</span>
                </a>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-400 transition-colors"
            data-testid="mobile-logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px]">Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
