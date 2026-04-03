import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getProfile, type UserProfile } from "../lib/api";
import { useEffect } from "react";

const NAV_ITEMS = [
  {
    to: "/app",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    exact: true,
  },
  {
    to: "/app/new",
    label: "New Session",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    to: "/app/progress",
    label: "My Progress",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, to: string, exact?: boolean) {
  if (exact) return pathname === to;
  return pathname.startsWith(to);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const remaining =
    profile && profile.plan === "free" && profile.daily_limit != null
      ? Math.max(0, profile.daily_limit - profile.daily_sessions_used)
      : null;

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <Link to="/app" className="text-lg font-bold text-white tracking-tight">
          InterviewPrep<span className="text-indigo-400">AI</span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(location.pathname, item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 space-y-3 border-t border-gray-800/60 pt-4 mt-2">
        {remaining !== null && (
          <div className="px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Free plan</span>
              <span className={remaining === 0 ? "text-amber-400" : "text-gray-300"}>
                {remaining}/{profile?.daily_limit} left today
              </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${remaining === 0 ? "bg-amber-500" : "bg-indigo-500"}`}
                style={{
                  width: `${((profile?.daily_sessions_used ?? 0) / (profile?.daily_limit ?? 2)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {user && (
          <div className="px-3 flex items-center justify-between">
            <span className="text-xs text-gray-600 truncate max-w-[140px]">
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r border-gray-800/60 bg-gray-950">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-gray-950 border-r border-gray-800/60 transform transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <Link to="/app" className="text-lg font-bold text-white tracking-tight">
            InterviewPrep<span className="text-indigo-400">AI</span>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
