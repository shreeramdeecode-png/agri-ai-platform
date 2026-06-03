import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquarePlus, History, User, LogOut, FileText, Image as ImageIcon } from "lucide-react";

export default function UserLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/");
  };

  const handleNewChat = () => {
    localStorage.removeItem("activeConversation");
    localStorage.removeItem("activeConversationThread");
    window.dispatchEvent(new CustomEvent("newChat"));
    setLocation("/search");
  };

  const sidebarItems = [
    { path: "/search", label: "New Chat", shortLabel: "Chat", icon: MessageSquarePlus, onClick: handleNewChat },
    { path: "/history", label: "History", shortLabel: "History", icon: History },
    { path: "/documents", label: "Documents", shortLabel: "Docs", icon: FileText },
    { path: "/images", label: "Images", shortLabel: "Images", icon: ImageIcon },
    { path: "/profile", label: "Settings", shortLabel: "Settings", icon: User },
  ];

  const renderNavItem = (
    item: (typeof sidebarItems)[number],
    isActive: boolean,
    testIdPrefix: string,
    showLabel: string
  ) => {
    const Icon = item.icon;
    const className = `flex flex-col items-center justify-center gap-0.5 w-full py-1 transition-colors ${
      isActive ? "text-emerald-400" : "text-gray-400 hover:text-emerald-400"
    }`;

    if (item.onClick) {
      return (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={className}
          data-testid={`${testIdPrefix}-${item.label.toLowerCase().replace(/\s/g, "-")}`}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="text-[9px] sm:text-[10px] leading-tight text-center truncate max-w-full px-0.5">
            {showLabel}
          </span>
        </button>
      );
    }

    return (
      <Link key={item.path + item.label} href={item.path}>
        <a className={className} data-testid={`${testIdPrefix}-${item.label.toLowerCase()}`}>
          <Icon className="w-5 h-5 shrink-0" />
          <span className="text-[9px] sm:text-[10px] leading-tight text-center truncate max-w-full px-0.5">
            {showLabel}
          </span>
        </a>
      </Link>
    );
  };

  const isChat = location === "/search";
  const mainBottomPad =
    "pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-8";

  return (
    <div className="min-h-[100dvh] min-h-screen bg-[#1a2332] flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-20 bg-[#141d2b] flex-col items-center py-6 space-y-8 border-r border-[#2a3749] shrink-0">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col items-center gap-6 pt-8 w-full">
          {sidebarItems.map((item) => renderNavItem(item, location === item.path, "link", item.label))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-400 transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px]">Logout</span>
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Header: mobile = logo + avatar only (no top text nav) */}
        <header className="shrink-0 bg-[#1a2332] border-b border-[#2a3749] safe-area-top">
          <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 gap-4">
            <div className="flex items-center gap-2 min-w-0 md:hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-white font-semibold truncate">AgriSearch</span>
            </div>

            <nav className="hidden md:flex flex-1 items-center justify-center gap-8">
              {sidebarItems.map((item) => {
                const isActive = location === item.path;
                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className={`text-sm font-medium transition-colors ${
                        isActive ? "text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                }
                return (
                  <Link key={item.path + item.label} href={item.path}>
                    <a
                      className={`text-sm font-medium transition-colors ${
                        isActive ? "text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </nav>

            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0 md:ml-auto">
              <span className="text-white text-sm">{user.email?.[0]?.toUpperCase() || "U"}</span>
            </div>
          </div>
        </header>

        <main
          className={`flex-1 min-h-0 min-w-0 ${
            isChat
              ? `flex flex-col overflow-hidden px-0 py-0 ${mainBottomPad} md:px-8 md:py-8`
              : `overflow-y-auto overflow-x-hidden scrollbar-hide p-4 md:p-8 ${mainBottomPad}`
          }`}
        >
          {children}
        </main>

        {/* Mobile bottom nav — equal grid columns, centered icons */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#141d2b] border-t border-[#2a3749] safe-area-bottom"
          aria-label="Main navigation"
        >
          <div className="grid grid-cols-6 w-full max-w-lg mx-auto px-1 pt-1.5 pb-1">
            {sidebarItems.map((item) =>
              renderNavItem(item, location === item.path, "mobile", item.shortLabel)
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-col items-center justify-center gap-0.5 w-full py-1 text-gray-400 hover:text-red-400 transition-colors"
              data-testid="mobile-logout"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="text-[9px] sm:text-[10px] leading-tight">Logout</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
