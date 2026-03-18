/**
 * Root component with React Router. Routes:
 * - `/` — Dashboard (session list)
 * - `/new` — NewSession (create prep session)
 * - `/prep/:id` — PrepDetail (session detail with Analysis/Q&A/Role-Play tabs)
 */
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewSession from "./pages/NewSession";
import PrepDetail from "./pages/PrepDetail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            InterviewPrep<span className="text-indigo-400">AI</span>
          </Link>
          <Link
            to="/new"
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            + New Session
          </Link>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewSession />} />
          <Route path="/prep/:id" element={<PrepDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
