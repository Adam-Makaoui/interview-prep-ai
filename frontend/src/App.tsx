import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewSession from "./pages/NewSession";
import PrepDetail from "./pages/PrepDetail";

function AppHeader() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  if (location.pathname === "/" || location.pathname === "/login") return null;

  return (
    <header className="border-b border-gray-800/60 px-6 py-4 backdrop-blur-sm flex items-center justify-between">
      <Link to="/app" className="text-xl font-bold text-white tracking-tight">
        InterviewPrep<span className="text-indigo-400">AI</span>
      </Link>
      {user && (
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      )}
    </header>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-gray-800" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-950">
          <AppHeader />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Protected app routes */}
            <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/app/new" element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
            <Route path="/app/prep/:id" element={<ProtectedRoute><PrepDetail /></ProtectedRoute>} />

            {/* Legacy routes redirect to /app/* */}
            <Route path="/new" element={<Navigate to="/app/new" replace />} />
            <Route path="/prep/:id" element={<Navigate to="/app/prep/:id" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
