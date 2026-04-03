import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProgress, type ProgressData } from "../lib/api";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from "recharts";

function StatCard({ label, value, accent = "text-white" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/40 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function fmtLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function CompetencyBars({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).sort((a, b) => b[1] - a[1]).map(([name, score]) => ({ name: fmtLabel(name), score }));
  if (!chartData.length) return null;
  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/40 p-5">
      <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Competency Averages</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#d1d5db", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#d1d5db" }} itemStyle={{ color: "#818cf8" }} />
            <Bar dataKey="score" fill="#818cf8" radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ScoreTrend({ data }: { data: { date: string; score: number }[] }) {
  if (data.length < 2) return null;
  const chartData = data.map((d) => ({ date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score: d.score }));
  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/40 p-5">
      <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-4">Score Trend</h2>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} />
            <YAxis domain={[0, 10]} tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#d1d5db" }} itemStyle={{ color: "#22d3ee" }} />
            <Line type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#22d3ee" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
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
          <div className="absolute inset-0 rounded-full border-2 border-gray-800" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || data.sessions_completed === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-6">My Progress</h1>
        <div className="text-center py-20 rounded-2xl border border-dashed border-gray-800/60 bg-gray-900/20">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-indigo-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg font-medium mb-2">No scored sessions yet</p>
          <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">Complete a role-play session to see your performance tracked here over time.</p>
          <Link to="/app/new" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm shadow-indigo-500/20">Start a session</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Progress</h1>
        <p className="text-gray-500 text-sm mt-1">Cross-session performance across all your interviews</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Sessions Scored" value={data.sessions_completed} accent="text-indigo-400" />
        <StatCard label="Questions Practiced" value={data.total_questions} accent="text-cyan-400" />
        <StatCard label="Strongest" value={data.strongest ? fmtLabel(data.strongest) : "\u2014"} accent="text-emerald-400" />
        <StatCard label="Needs Work" value={data.weakest ? fmtLabel(data.weakest) : "\u2014"} accent="text-amber-400" />
      </div>
      <CompetencyBars data={data.competency_averages} />
      <ScoreTrend data={data.score_trend} />
      {data.weakest && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Practice suggestion</h2>
          <p className="text-gray-300 text-sm leading-relaxed">Your <span className="font-medium text-amber-300">{fmtLabel(data.weakest)}</span> scores are below your other competencies. Consider running another session focused on this area.</p>
          <Link to="/app/new" className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Start a practice session
          </Link>
        </div>
      )}
    </div>
  );
}
