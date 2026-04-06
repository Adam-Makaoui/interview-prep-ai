import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate("/app");
    return null;
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Auth not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
      );
      return;
    }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950 flex items-center justify-center px-4 relative">
      <Link
        to="/"
        className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800/60 transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8">
          <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            InterviewPrep<span className="text-indigo-500 dark:text-indigo-400">AI</span>
          </span>
        </Link>

        {sent ? (
          <div className="rounded-xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800/60 shadow-lg p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-gray-900 dark:text-white font-semibold mb-1">Check your email</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              We sent a magic link to <span className="text-gray-900 dark:text-white font-medium">{email}</span>.
              Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="rounded-xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800/60 shadow-lg p-6 space-y-4">
            <h2 className="text-gray-900 dark:text-white font-semibold text-lg text-center">
              Sign in to start prepping
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
              No password needed -- we'll email you a magic link.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-sm text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
            <p className="text-gray-500 dark:text-gray-400 text-xs text-center">
              First time? We'll create your account automatically.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
