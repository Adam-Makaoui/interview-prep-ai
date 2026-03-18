import { BrowserRouter, Routes, Route } from "react-router-dom";
import NewSession from "./pages/NewSession";
import PrepDetail from "./pages/PrepDetail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <header className="border-b border-gray-800 px-6 py-4">
          <a href="/" className="text-xl font-bold text-white tracking-tight">
            InterviewPrep<span className="text-indigo-400">AI</span>
          </a>
        </header>
        <Routes>
          <Route path="/" element={<NewSession />} />
          <Route path="/prep/:id" element={<PrepDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
