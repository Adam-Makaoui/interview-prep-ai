import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "../lib/auth";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getProfile,
  putLlmModel,
  putTheme,
  type UserProfile,
} from "../lib/api";
import { useTheme } from "../lib/theme";

function AiModelSection({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (p: UserProfile) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const choices = profile.llm_model_choices ?? [];
  const stored = profile.llm_model ?? "";
  const effective = profile.llm_model_effective ?? "";
  const selectedId =
    stored && choices.some((choice) => choice.id === stored && choice.available)
      ? stored
      : effective || choices.find((choice) => choice.available)?.id || "";

  const pick = async (id: string) => {
    const choice = choices.find((item) => item.id === id);
    if (!choice?.available) return;
    setSaving(true);
    setErr("");
    try {
      const partial = await putLlmModel(id);
      onUpdate({
        ...profile,
        llm_model: partial.llm_model ?? id,
        llm_model_effective: partial.llm_model_effective ?? id,
        llm_model_choices: partial.llm_model_choices ?? profile.llm_model_choices,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save model");
    } finally {
      setSaving(false);
    }
  };

  if (!choices.length) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>AI model</CardTitle>
        <CardDescription>
          Choose which OpenAI model runs your prep sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {choices.map((choice) => (
          <label
            key={choice.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
              selectedId === choice.id
                ? "border-indigo-500 bg-indigo-50/80 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
            } ${!choice.available ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <input
              type="radio"
              name="llm-model"
              className="mt-1"
              checked={selectedId === choice.id}
              disabled={!choice.available || saving}
              onChange={() => void pick(choice.id)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {choice.label}
                </span>
                {choice.min_plan === "pro" && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                    Pro
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {choice.description}
              </p>
            </div>
          </label>
        ))}
        {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
        {err && <p className="text-xs text-destructive">{err}</p>}
        <p className="pt-1 text-xs text-muted-foreground">
          Saved to your account. Pro unlocks premium models.
        </p>
      </CardContent>
    </Card>
  );
}

function ResumesLinkCard() {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader>
        <CardTitle>Resumes</CardTitle>
        <CardDescription>
          Save up to two resumes. Pick one as your default for new sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Upload, edit, and switch resumes from one dedicated place.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/resumes">Manage resumes</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState("");

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const plan = profile?.plan ?? "free";
  const proPriceLabel = "$19/month";

  const redirectToBilling = async (kind: "checkout" | "portal") => {
    setBillingLoading(true);
    setBillingError("");
    try {
      const url = kind === "checkout" ? await createCheckoutSession() : await createCustomerPortalSession();
      window.location.assign(url);
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : "Could not open billing");
      setBillingLoading(false);
    }
  };

  const saveThemePreference = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemeError("");

    if (!user || !profile?.authenticated) {
      setTheme(nextTheme);
      return;
    }

    setThemeSaving(true);
    try {
      const partial = await putTheme(nextTheme);
      const savedTheme =
        partial.theme === "dark" || partial.theme === "light"
          ? partial.theme
          : nextTheme;
      setTheme(savedTheme);
      setProfile({ ...profile, theme: savedTheme });
    } catch (e) {
      setThemeError(e instanceof Error ? e.message : "Could not save theme");
    } finally {
      setThemeSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, billing, resumes, and preferences.
        </p>
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          {plan === "pro" ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Pro plan</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {proPriceLabel} · Unlimited prep sessions
                </p>
                {profile?.stripe_subscription_status && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Subscription status: {profile.stripe_subscription_status}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
                  Active
                </span>
                <Button type="button" variant="outline" disabled={billingLoading} onClick={() => redirectToBilling("portal")}>
                  {billingLoading ? "Opening..." : "Manage billing"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-foreground">Free plan</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {profile?.daily_limit ?? 2} prep sessions per day
                </p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">
                  Upgrade to Pro for unlimited prep sessions
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each session can include prep materials and a role-play practice interview. Pro adds priority generation, deeper history, and premium AI models.
                </p>
                <Button type="button" disabled={billingLoading} className="mt-3" onClick={() => redirectToBilling("checkout")}>
                  {billingLoading ? "Starting checkout..." : `Upgrade to Pro — ${proPriceLabel}`}
                </Button>
              </div>
            </div>
          )}
          {billingError && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {billingError}
            </p>
          )}
        </CardContent>
      </Card>

      {user && <ResumesLinkCard />}

      {user && profile?.authenticated && profile.llm_model_choices && profile.llm_model_choices.length > 0 && (
        <AiModelSection profile={profile} onUpdate={setProfile} />
      )}

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {theme === "dark" ? "Dark mode is on." : "Light mode is on."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={theme === "light"}
              onClick={() => void saveThemePreference()}
              disabled={themeSaving}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                theme === "light" ? "bg-primary" : "bg-muted"
              } ${themeSaving ? "cursor-wait opacity-70" : ""}`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-background shadow-sm transition-transform ${
                  theme === "light" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {themeError && (
            <p className="mt-3 text-xs text-destructive">{themeError}</p>
          )}
          {user && profile?.authenticated && !themeError && (
            <p className="mt-3 text-xs text-muted-foreground">
              Saved to your account for this environment.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Questions or feedback? Send a note anytime.
          </p>
          <Button asChild>
            <a href="mailto:adam.makaoui@outlook.com?subject=InterviewIntel%20support">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
              Contact Support
            </a>
          </Button>
          <p className="pt-2 text-xs text-muted-foreground">
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/adammakaoui"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Adam Makaoui
            </a>
          </p>
        </CardContent>
      </Card>

      {user && <p className="text-center text-xs text-muted-foreground">Signed in as {user.email}</p>}
    </div>
  );
}
