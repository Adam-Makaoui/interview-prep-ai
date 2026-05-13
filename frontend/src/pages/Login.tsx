// Login.tsx — public authentication page for InterviewIntel.
//
// Visual design follows a "Nord Account"-style layout: a single centered card
// on a near-black surface, a wordmark lockup at the top of the card, a bold
// heading + muted tagline, the primary email→Continue magic-link flow, and a
// pill-style "Continue with Google" alternative below a thin hairline. A
// minimal footer pins copyright, a support mailto, and a theme toggle.
//
// Behavior is unchanged from the prior version: magic-link via Supabase OTP,
// Google OAuth, troubleshooting tips, and a sent-state with resend.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";

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
  const { theme, toggleTheme } = useTheme();
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

  // Page shell: full-height column with a centered card region and a thin footer pinned to the bottom.
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0a0a14] text-gray-900 dark:text-gray-100 relative">
      {/* Close affordance — returns to landing without losing magic-link send state. */}
      <Link
        to="/"
        className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-white/5 transition-colors z-10"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>

      {/* Centered card column. flex-1 absorbs vertical slack so the footer sits at the page bottom. */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {sent ? (
            <SentStateCard
              email={email}
              loading={loading}
              error={error}
              showTroubleshoot={showTroubleshoot}
              onToggleTips={() => setShowTroubleshoot((v) => !v)}
              onResend={handleResend}
            />
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#11121d] border border-gray-200 dark:border-white/5 shadow-2xl shadow-black/40 px-7 py-9 sm:px-9 sm:py-10">
              {/* Wordmark lockup at the top of the card — small dot mark + "InterviewIntel". */}
              <Wordmark className="mb-7" />

              <h1 className="text-center text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                Log in
              </h1>
              <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                New here?{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  We'll create your account automatically.
                </span>
              </p>

              {/* Primary path: email → Continue (sends a magic link). */}
              <form onSubmit={handleMagicLink} className="mt-7 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  className="w-full rounded-xl bg-white dark:bg-[#0d0e18] border border-gray-300 dark:border-white/10 px-4 py-3 text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
                />
                {error && (
                  <p className="text-red-600 dark:text-red-400 text-sm" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-[15px] font-semibold text-white transition-colors"
                >
                  {loading ? "Sending…" : "Continue"}
                </button>
                <p className="text-center text-xs text-gray-500 dark:text-gray-500">
                  We'll email you a one-tap sign-in link.
                </p>
              </form>

              {/* Thin hairline divider before alternative auth methods. */}
              <div className="my-6 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />

              {/* Alt auth — currently just Google. Pill-shaped to mirror Nord. */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 rounded-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0d0e18] px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
                aria-label="Sign in with Google"
              >
                <GoogleGlyph />
                {googleLoading ? "Redirecting…" : "Sign in with Google"}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer — copyright + support mailto on the left, theme toggle on the right. */}
      <footer className="px-6 py-5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
        <div className="flex items-center gap-5">
          <span>© 2026 InterviewIntel. All rights reserved.</span>
          <a
            href="mailto:adam.makaoui@outlook.com?subject=InterviewIntel%20support"
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Support center
          </a>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <ThemeGlyph theme={theme} />
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </button>
      </footer>
    </div>
  );
}

// SentStateCard — magic-link confirmation panel with troubleshooting tips and a
// resend control. Split out so the form card and the confirmation card share
// the same outer dimensions without duplicating layout chrome.
function SentStateCard({
  email,
  loading,
  error,
  showTroubleshoot,
  onToggleTips,
  onResend,
}: {
  email: string;
  loading: boolean;
  error: string;
  showTroubleshoot: boolean;
  onToggleTips: () => void;
  onResend: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#11121d] border border-gray-200 dark:border-white/5 shadow-2xl shadow-black/40 px-7 py-9 sm:px-9 sm:py-10 text-center">
      <Wordmark className="mb-7" />
      <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
        <svg
          className="w-6 h-6 text-indigo-500 dark:text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Check your email
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        We sent a magic link to{" "}
        <span className="text-gray-900 dark:text-white font-medium">{email}</span>. Click it to sign
        in.
      </p>

      <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/5 text-left">
        <button
          type="button"
          onClick={onToggleTips}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showTroubleshoot ? "Hide tips" : "Email not arriving?"}
        </button>
        {showTroubleshoot && (
          <ul className="mt-2 space-y-1.5 text-xs text-gray-500 dark:text-gray-400 list-disc pl-4">
            <li>Check your spam / promotions folder.</li>
            <li>
              Gmail sometimes pre-scans the link and invalidates it on the first click. If that
              happens, request a new one below and open it from the same device.
            </li>
            <li>Wait about a minute before re-requesting (rate limit).</li>
            <li>
              If you use Google, the "Sign in with Google" button on the previous screen bypasses
              email entirely and is the most reliable option.
            </li>
          </ul>
        )}

        <button
          type="button"
          onClick={onResend}
          disabled={loading}
          className="mt-3 w-full rounded-full border border-gray-300 dark:border-white/10 px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
        >
          {loading ? "Resending…" : "Resend magic link"}
        </button>
        {error && (
          <p className="text-red-600 dark:text-red-400 text-xs mt-2" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// Wordmark — small dot mark + "InterviewIntel" lockup, centered. Mirrors the
// Nord Account header lockup so the card has visual weight at the top.
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center justify-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      >
        <span className="block h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-white">
        Interview<span className="text-indigo-500 dark:text-indigo-400">Intel</span>
      </span>
    </Link>
  );
}

// ThemeGlyph — small sun/moon icon mirroring the current theme so the footer
// toggle reads at a glance. Sun = currently light, moon = currently dark.
function ThemeGlyph({ theme }: { theme: "dark" | "light" }) {
  if (theme === "dark") {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
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
