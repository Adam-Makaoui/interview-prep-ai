import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import AppShell from "./components/AppShell";
import RouteFade from "./components/RouteFade";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewSession from "./pages/NewSession";
import PrepDetail from "./pages/PrepDetail";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";

function AuthLoadingSpinner() {
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

  if (loading) return <AuthLoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

/**
 * Root-route guard: signed-in visitors skip the marketing landing and go straight to the app shell.
 * Rendering `null` during `loading` avoids a flash of the landing page for returning users.
 */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return <Landing />;
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
              <HomeRoute />
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
          <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
            <AnimatedRoutes />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
