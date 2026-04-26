import { useState } from "react";
import { createCheckoutSession } from "../lib/api";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const STRIPE_CHECKOUT_URL = import.meta.env.VITE_STRIPE_CHECKOUT_URL || "";
const PRO_PRICE_LABEL = "$19";

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const startCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const url = await createCheckoutSession();
      window.location.assign(url);
    } catch (e) {
      if (STRIPE_CHECKOUT_URL) {
        window.location.assign(STRIPE_CHECKOUT_URL);
        return;
      }
      setError(e instanceof Error ? e.message : "Could not start checkout");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center relative shadow-xl dark:shadow-none">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upgrade to Pro</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
          You&apos;ve reached today&apos;s free limit (2 sessions/day).
          Upgrade for unlimited interview prep sessions,
          full scorecard history, and priority access to new features.
        </p>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 p-4 mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{PRO_PRICE_LABEL}</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">/month</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Cancel anytime</p>
        </div>

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-sm text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
        >
          {loading ? "Starting checkout..." : "Upgrade Now"}
        </button>
        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
