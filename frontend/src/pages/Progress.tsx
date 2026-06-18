// User Progress page for the application.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProgress, type ProgressData } from "../lib/api";
import { useTheme } from "../lib/theme";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from "recharts";

function StatCard({ label, value, accent = "text-foreground" }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function fmtLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// CompetencyBars component for the progress page.
function CompetencyBars({ data }: { data: Record<string, number> }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridStroke = isDark ? "#1f2937" : "#e5e7eb";
  const yTick = isDark ? "#d1d5db" : "#4b5563";
  const xTick = isDark ? "#6b7280" : "#6b7280";
  const tipBg = isDark ? "#111827" : "#ffffff";
  const tipBorder = isDark ? "#374151" : "#e5e7eb";
  const labelColor = isDark ? "#d1d5db" : "#374151";

  const chartData = Object.entries(data).sort((a, b) => b[1] - a[1]).map(([name, score]) => ({ name: fmtLabel(name), score }));
  if (!chartData.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Skill breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: xTick, fontSize: 12 }} axisLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: yTick, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: tipBg, border: `1px solid ${tipBorder}`, borderRadius: 8 }} labelStyle={{ color: labelColor }} itemStyle={{ color: "#818cf8" }} />
              <Bar dataKey="score" fill="#818cf8" radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreTrend({ data }: { data: { date: string; score: number }[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridStroke = isDark ? "#1f2937" : "#e5e7eb";
  const tickFill = isDark ? "#6b7280" : "#6b7280";
  const tipBg = isDark ? "#111827" : "#ffffff";
  const tipBorder = isDark ? "#374151" : "#e5e7eb";
  const labelColor = isDark ? "#d1d5db" : "#374151";

  if (data.length < 2) return null;
  const chartData = data.map((d) => ({ date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score: d.score }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
          Score over time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: tickFill, fontSize: 12 }} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: tipBg, border: `1px solid ${tipBorder}`, borderRadius: 8 }} labelStyle={{ color: labelColor }} itemStyle={{ color: "#22d3ee" }} />
              <Line type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#22d3ee" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Progress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgress().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-800" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || data.sessions_completed === 0) {
    return (
      <PageContainer size="lg">
        <PageHeader title="My Progress" />
        <div className="text-center py-20 rounded-2xl border border-dashed border-border bg-muted/40">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-foreground text-lg font-medium mb-2">No scored sessions yet</p>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Finish a mock interview to see strengths, weak spots, and score trends.
          </p>
          <Button asChild>
            <Link to="/app/new">Start a session</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg" className="space-y-6">
      <PageHeader
        title="My Progress"
        description="Track how your practice interviews improve over time."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Scored sessions" value={data.sessions_completed} accent="text-indigo-600 dark:text-indigo-400" />
        <StatCard label="Questions answered" value={data.total_questions} accent="text-cyan-600 dark:text-cyan-400" />
        <StatCard label="Strongest" value={data.strongest ? fmtLabel(data.strongest) : "\u2014"} accent="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Needs Work" value={data.weakest ? fmtLabel(data.weakest) : "\u2014"} accent="text-amber-600 dark:text-amber-400" />
      </div>
      <CompetencyBars data={data.competency_averages} />
      <ScoreTrend data={data.score_trend} />
      {data.weakest && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-5">
          <h2 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Practice suggestion</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">Your <span className="font-medium text-amber-800 dark:text-amber-300">{fmtLabel(data.weakest)}</span> scores are below your other competencies. Consider running another session focused on this area.</p>
          <Link to="/app/new" className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Start a practice session
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
