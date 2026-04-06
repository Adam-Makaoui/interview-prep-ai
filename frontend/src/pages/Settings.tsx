import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getProfile, type UserProfile } from "../lib/api";

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const plan = profile?.plan ?? "free";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription, get support, and customize your experience.
        </p>
      </div>

      {/* Subscription */}
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Subscription</h2>
        </div>
        <div className="px-6 py-5">
          {plan === "pro" ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Pro Plan</p>
                <p className="text-sm text-gray-500 mt-0.5">$29/month</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Active
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900">Free Plan</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {profile?.daily_limit ?? 2} sessions per day
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                <p className="text-sm font-medium text-indigo-900">
                  Upgrade to Pro for unlimited sessions
                </p>
                <p className="text-sm text-indigo-600 mt-1">
                  Unlock unlimited daily sessions, priority generation, and advanced analytics.
                </p>
                <button
                  disabled
                  className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
                >
                  Coming soon
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Support */}
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Support</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Need help or have feedback? Reach out and we'll get back to you within 24 hours.
          </p>
          <a
            href="mailto:support@interviewprepai.com"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Contact Support
          </a>
          <p className="text-xs text-gray-400 pt-2">
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/adammakaoui"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-600 transition-colors"
            >
              Adam Makaoui
            </a>
          </p>
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Theme</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Light theme is active. Dark mode coming soon.
              </p>
            </div>
            <div
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 cursor-not-allowed opacity-50"
              aria-label="Dark mode toggle (disabled)"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* Account info */}
      {user && (
        <p className="text-xs text-gray-400 text-center">
          Signed in as {user.email}
        </p>
      )}
    </div>
  );
}
