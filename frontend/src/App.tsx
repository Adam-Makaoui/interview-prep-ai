import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider, useTheme } from "./lib/theme";
import { getProfile } from "./lib/api";
import AppShell from "./components/AppShell";
import RouteFade from "./components/RouteFade";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewSession from "./pages/NewSession";
import PrepDetail from "./pages/PrepDetail";
import Progress from "./pages/Progress";
import Resumes from "./pages/Resumes";
import Settings from "./pages/Settings";

/**
 * AuthLoading — quiet centered spinner used while Supabase resolves the session.
 *
 * Reused by ProtectedRoute and LandingGate so signed-in visitors don't see a
 * flash of the landing page before the redirect to /app happens.
 */
function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoading />;

  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

/**
 * LandingGate — render the marketing landing for guests, redirect signed-in
 * users straight to /app. Shows a quiet spinner while auth resolves so the
 * landing never flashes for already-authenticated visitors.
 */
function LandingGate() {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/app" replace />;
  return <Landing />;
}

function ProfileThemeSync() {
  const { user, loading } = useAuth();
  const { setServerTheme } = useTheme();

  useEffect(() => {
    if (loading || !user) return;
    let active = true;

    // Server profile wins after auth; localStorage remains only the fast boot cache.
    getProfile()
      .then((profile) => {
        if (!active) return;
        if (profile.theme === "dark" || profile.theme === "light") {
          setServerTheme(profile.theme);
        }
      })
      .catch(() => {
        /* Keep the already-applied local/OS theme if profile sync is unavailable. */
      });

    return () => {
      active = false;
    };
  }, [loading, setServerTheme, user]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <RouteFade>
              <LandingGate />
            </RouteFade>
          }
        />
        <Route
          path="/login"
          element={
            <RouteFade>
              <Login />
            </RouteFade>
          }
        />

        <Route
          path="/app"
          element={
            <RouteFade>
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </RouteFade>
          }
        />
        <Route
          path="/app/new"
          element={
            <RouteFade>
              <ProtectedRoute>
                <NewSession />
              </ProtectedRoute>
            </RouteFade>
          }
        />
        <Route
          path="/app/prep/:id"
          element={
            <RouteFade>
              <ProtectedRoute>
                <PrepDetail />
              </ProtectedRoute>
            </RouteFade>
          }
        />
        <Route
          path="/app/progress"
          element={
            <RouteFade>
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            </RouteFade>
          }
        />
        <Route
          path="/app/resumes"
          element={
            <RouteFade>
              <ProtectedRoute>
                <Resumes />
              </ProtectedRoute>
            </RouteFade>
          }
        />
        <Route
          path="/app/settings"
          element={
            <RouteFade>
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            </RouteFade>
          }
        />

        <Route path="/new" element={<Navigate to="/app/new" replace />} />
        <Route path="/prep/:id" element={<Navigate to="/app/prep/:id" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ProfileThemeSync />
          <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
            <AnimatedRoutes />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
