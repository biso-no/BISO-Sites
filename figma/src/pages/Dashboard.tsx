import { Activity, ArrowUpRight, Eye, TrendingUp, Users } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MOCK_USER_IMAGE } from "../data";

const data = [
  { name: "Mon", views: 4000, unique: 2400 },
  { name: "Tue", views: 5000, unique: 1398 },
  { name: "Wed", views: 9000, unique: 6800 },
  { name: "Thu", views: 8780, unique: 3908 },
  { name: "Fri", views: 11_900, unique: 4800 },
  { name: "Sat", views: 14_000, unique: 8800 },
  { name: "Sun", views: 18_000, unique: 12_000 },
];

export function Dashboard() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <header className="flex flex-col justify-between gap-6 pt-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 font-mono text-[#3DA9E0] text-sm uppercase tracking-widest">
            Overview
          </p>
          <h1 className="font-light text-4xl text-white tracking-tight md:text-5xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-white to-white/50 bg-clip-text font-semibold text-transparent">
              Alex
            </span>
            .
          </h1>
        </div>
        <div className="flex gap-4">
          <Link
            className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
            to="/drafts"
          >
            Review Drafts
          </Link>
          <Link
            className="rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
            to="/editor/new"
          >
            New Page
          </Link>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Views", value: "2.4M", trend: "+12.5%", icon: Eye },
          {
            label: "Active Users",
            value: "14.2K",
            trend: "+5.2%",
            icon: Users,
          },
          { label: "Engagement", value: "68%", trend: "+2.1%", icon: Activity },
          {
            label: "Conversion",
            value: "4.3%",
            trend: "+1.2%",
            icon: TrendingUp,
          },
        ].map((stat, i) => (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm transition-colors hover:bg-white/[0.04]"
            initial={{ opacity: 0, scale: 0.95 }}
            key={i}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <div className="absolute top-0 right-0 p-6 opacity-20 transition-opacity group-hover:opacity-40">
              <stat.icon className="text-[#3DA9E0]" size={48} />
            </div>
            <p className="relative z-10 mb-4 font-medium text-sm text-white/50">
              {stat.label}
            </p>
            <div className="relative z-10 flex items-end gap-3">
              <span className="font-semibold text-4xl text-white tracking-tight">
                {stat.value}
              </span>
              <span className="mb-1 flex items-center rounded-md bg-emerald-400/10 px-2 py-1 font-mono text-emerald-400 text-sm">
                <ArrowUpRight className="mr-1" size={14} /> {stat.trend}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Chart Area */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm md:p-8 lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-medium text-white text-xl">Traffic Overview</h2>
            <select className="appearance-none rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 outline-none transition-colors focus:border-[#3DA9E0]">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorViews" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#3DA9E0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3DA9E0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="name"
                  fontSize={12}
                  stroke="rgba(255,255,255,0.2)"
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  fontSize={12}
                  stroke="rgba(255,255,255,0.2)"
                  tickFormatter={(value) => `${value / 1000}k`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#000a16",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  dataKey="views"
                  fill="url(#colorViews)"
                  fillOpacity={1}
                  stroke="#3DA9E0"
                  strokeWidth={3}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm md:p-8">
          <h2 className="mb-6 font-medium text-white text-xl">
            Recent Activity
          </h2>
          <div className="space-y-6">
            {[
              {
                user: "Sarah Jenkins",
                action: "published",
                target: "Student Life",
                time: "2m ago",
              },
              {
                user: "Admin",
                action: "edited",
                target: "Homepage",
                time: "1h ago",
              },
              {
                user: "Event Team",
                action: "created draft",
                target: "Fadderullan 2026",
                time: "3h ago",
              },
              {
                user: "Shop Manager",
                action: "updated",
                target: "Premium Merch",
                time: "1d ago",
              },
            ].map((activity, i) => (
              <div className="group flex items-start gap-4" key={i}>
                <div className="relative">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 transition-colors group-hover:border-[#3DA9E0]">
                    <img
                      alt={activity.user}
                      className="h-full w-full object-cover"
                      src={MOCK_USER_IMAGE}
                    />
                  </div>
                  {i !== 3 && (
                    <div className="absolute top-10 left-1/2 h-6 w-[1px] -translate-x-1/2 bg-white/10" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-white/80">
                    <span className="font-semibold text-white">
                      {activity.user}
                    </span>{" "}
                    {activity.action}{" "}
                    <span className="text-[#3DA9E0]">{activity.target}</span>
                  </p>
                  <p className="mt-1 font-mono text-white/40 text-xs">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Link
            className="mt-8 block w-full rounded-xl border border-white/10 py-3 text-center text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
            to="/activity"
          >
            View All Activity
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
