import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

// Maps a Supabase auth error to a user-facing message. Prefers Supabase's
// structured error codes (stable across SDK versions) before falling back to
// substring matching on the message text. Always logs the raw error so future
// debugging doesn't require source-diving.
function getMagicLinkErrorMessage(err: {
  message: string;
  code?: string;
  status?: number;
}): string {
  const code = err.code?.toLowerCase() ?? "";
  const status = err.status;
  const msg = err.message.toLowerCase();

  console.error("[login] signInWithOtp failed:", {
    code: err.code,
    status,
    message: err.message,
  });

  if (code === "over_email_send_rate_limit") {
    return "Too many magic-link requests to this email in the last hour. Please wait ~60 min and try again, or use Continue with Google.";
  }
  if (code === "over_request_rate_limit" || status === 429) {
    return "Too many requests from this device. Please wait a minute and try again.";
  }
  if (code === "validation_failed" || code === "email_address_invalid") {
    return "That doesn't look like a valid email. Please double-check and try again.";
  }
  if (code === "email_address_not_authorized") {
    return "This email isn't allowed to sign in yet. If you're expecting access, contact support.";
  }
  if (code === "email_provider_disabled") {
    return "Email sign-in is temporarily disabled. Please use Continue with Google.";
  }
  if (code === "signup_disabled" || code === "signups_not_allowed") {
    return "New sign-ups are disabled. If you have an account, use Continue with Google.";
  }
  if (code === "unexpected_failure" || status === 500) {
    return "Auth service hit an unexpected error. Try Continue with Google, or try again in a few minutes.";
  }

  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again, or use Continue with Google.";
  }
  if (msg.includes("site url") || msg.includes("redirect")) {
    return "Magic-link redirect is misconfigured on the server. Please contact support.";
  }
  if (msg.includes("smtp") || msg.includes("delivery")) {
    return "The email provider rejected the send. Try Continue with Google, or contact support.";
  }
  if (msg.includes("invalid email") || msg.includes("email format")) {
    return "That doesn't look like a valid email. Please double-check and try again.";
  }

  return err.message.length > 140 ? err.message.slice(0, 140) + "…" : err.message;
}
// Main login component for handling authentication UI and logic.
// Manages state for email input, error messages, loading indicators,
// Google OAuth loading, magic link sent status, and troubleshooting prompt.
// Redirects to "/app" if a user is already authenticated.
export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const { user } = useAuth();
  // Use React Router's navigate function to redirect to "/app" if a user is already authenticated.
  const navigate = useNavigate();

  // Redirect to "/app" if a user is already authenticated.
  if (user) {
    navigate("/app");
    return null;
  }

  // Handle Google OAuth login.
  const handleGoogle = async () => {
    if (!supabase) {
      setError(
        "Auth not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
      );
      return;
    }
    setGoogleLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) {
      setGoogleLoading(false);
      setError(err.message);
    }
  };

  // Handle magic link email authentication.
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Auth not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
      );
      return;
    }

    // Normalize the email address to lowercase for consistency.
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setLoading(false);
    if (err) {
      setError(getMagicLinkErrorMessage(err));
    } else {
      setSent(true);
    }
  };

  // Handle resending the magic link email.
  const handleResend = async () => {
    if (!supabase || !email) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setLoading(false);
    if (err) setError(getMagicLinkErrorMessage(err));
  };

  // Main login UI component.
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950 flex items-center justify-center px-4 relative">
      <Link
        to="/"
        className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800/60 transition-colors"
        aria-label="Close"
      >
        {/* Close button to return to the landing page. */}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8">
          <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Interview<span className="text-indigo-500 dark:text-indigo-400">Intel</span>
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

            {/* Troubleshooting tips for magic link authentication. */}
            <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800/60 text-left">
              <button
                type="button"
                onClick={() => setShowTroubleshoot((v) => !v)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showTroubleshoot ? "Hide tips" : "Email not arriving?"}
              </button>
              {showTroubleshoot && (
                <ul className="mt-2 space-y-1.5 text-xs text-gray-500 dark:text-gray-400 list-disc pl-4">
                  <li>Check your spam / promotions folder.</li>
                  <li>
                    Gmail sometimes pre-scans the link and invalidates it on the first click. If that happens,
                    request a new one below and open it from the same device.
                  </li>
                  <li>Wait about a minute before re-requesting (rate limit).</li>
                  <li>
                    If you use Google, the "Continue with Google" button on the previous screen bypasses email
                    entirely and is the most reliable option.
                  </li>
                </ul>
              )}

              {/* Button to resend the magic link email. */}
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="mt-3 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 disabled:opacity-50 transition-colors"
              >
                {loading ? "Resending..." : "Resend magic link"}
              </button>
              {error && <p className="text-red-600 dark:text-red-400 text-xs mt-2">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800/60 shadow-lg p-6 space-y-4">
            <h2 className="text-gray-900 dark:text-white font-semibold text-lg text-center">
              Sign in to start prepping
            </h2>

            {/* Google OAuth button. */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 py-2.5 font-semibold text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
              aria-label="Continue with Google"
            >
              <GoogleGlyph />
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200 dark:border-gray-800/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 text-[11px] uppercase tracking-wider bg-white dark:bg-gray-900/90 text-gray-400 dark:text-gray-500">
                  or email me a link
                </span>
              </div>
            </div>

            {/* Magic link email form. */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className="w-full rounded-lg bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-sm text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
              <p className="text-gray-500 dark:text-gray-400 text-xs text-center">
                First time? We'll create your account automatically.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// Google glyph SVG for the Google OAuth button.
function GoogleGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 7.1 29.3 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
