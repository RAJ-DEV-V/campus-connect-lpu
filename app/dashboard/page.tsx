'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  FileSpreadsheet, 
  Award, 
  HelpCircle, 
  Download, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Search, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  GraduationCap
} from 'lucide-react';
import MaterialCard from '@/components/MaterialCard';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import { Material } from '@/lib/db/types';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentlyAdded, setRecentlyAdded] = useState<Material[]>([]);
  const [mostDownloaded, setMostDownloaded] = useState<Material[]>([]);
  const [recommended, setRecommended] = useState<Material[]>([]);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allowDownloads, setAllowDownloads] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const userRes = await fetch('/api/auth/me');
        if (!userRes.ok) {
          router.push('/login');
          return;
        }
        const userData = await userRes.json();
        if (!userData.authenticated || !userData.user) {
          router.push('/login');
          return;
        }
        if (!userData.user.community_joined && !userData.user.isAdmin) {
          router.push('/community');
          return;
        }
        setUser(userData.user);

        // Fetch Global Access Settings
        try {
          const settingsRes = await fetch('/api/admin/settings');
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            if (settingsData.settings && typeof settingsData.settings.allow_user_downloads === 'boolean') {
              setAllowDownloads(settingsData.settings.allow_user_downloads);
            }
          }
        } catch (settingsErr) {
          console.warn('Could not load settings on dashboard:', settingsErr);
        }

        // Fetch Recently Added
        const recentRes = await fetch('/api/materials?sortBy=newest&limit=4');
        if (recentRes.ok) {
          const d = await recentRes.json();
          setRecentlyAdded(d.materials || []);
        }

        // Fetch Most Downloaded
        const topRes = await fetch('/api/materials?sortBy=downloads&limit=4');
        if (topRes.ok) {
          const d = await topRes.json();
          setMostDownloaded(d.materials || []);
        }

        // Recommended (e.g. Mid-Term & End-Term)
        const recRes = await fetch('/api/materials?material_type=Mid-Term&limit=4');
        if (recRes.ok) {
          const d = await recRes.json();
          setRecommended(d.materials || []);
        }

      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/library');
    }
  };

  const categories = [
    { label: 'Notes', icon: BookOpen, type: 'Notes', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { label: 'Mid-Term', icon: FileSpreadsheet, type: 'Mid-Term', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
    { label: 'End-Term', icon: Award, type: 'End-Term', color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
    { label: 'PYQs', icon: HelpCircle, type: 'PYQs', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  ];

  const years = [
    { year: 1, label: '1st Year', subtitle: 'Freshmen Foundation', count: 'CSE101, MTH108' },
    { year: 2, label: '2nd Year', subtitle: 'Core Department', count: 'CSE205, CSE316' },
    { year: 3, label: '3rd Year', subtitle: 'Specializations', count: 'CSE322, CSE422' },
    { year: 4, label: '4th Year', subtitle: 'Capstone & Placements', count: 'CSE492, CSE489' },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-lpu-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading your academic dashboard...</p>
      </div>
    );
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'Student';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 academic-grid-pattern opacity-10 pointer-events-none hidden md:block" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Verified LPU Student Member
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Welcome, {firstName} 👋
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300">
            Your centralized study library is fully unlocked. Access curated notes, previous examination papers, and high-frequency PYQs.
          </p>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="mt-6 max-w-xl flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject (Programming in C, Data Structures, CSE101)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-400 text-xs focus:outline-none focus:border-lpu-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-lpu-600 hover:bg-lpu-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
            >
              Search Library
            </button>
          </form>
        </div>
      </div>

      {/* Your Study Library Category Pills */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Your Study Library
            </h2>
            <p className="text-xs text-slate-500">Jump directly into a category of materials</p>
          </div>
          <Link
            href="/library"
            className="text-xs font-bold text-lpu-600 hover:text-lpu-700 flex items-center gap-1"
          >
            Open Full Library <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.type}
                href={`/library?type=${cat.type}`}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all shadow-xs group ${cat.color}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">
                    {cat.label}
                  </h3>
                  <span className="text-[11px] opacity-75 font-medium group-hover:underline">
                    Browse All &rarr;
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Year Navigator */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Browse by Academic Year
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Year → Subject → Material Type → File</p>
          </div>
          <Link href="/library" className="text-xs font-bold text-lpu-600 hover:underline">
            View All Years
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {years.map((y) => (
            <Link
              key={y.year}
              href={`/library?year=${y.year}`}
              className="p-4 rounded-xl bg-slate-50 hover:bg-orange-50/70 border border-slate-200 hover:border-orange-300 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-black text-slate-900 group-hover:text-lpu-600">
                  {y.label}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                  Year {y.year}
                </span>
              </div>
              <div className="text-xs font-medium text-slate-500">
                {y.subtitle}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                {y.count}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recently Added Resources */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Recently Added Resources
              </h2>
              <p className="text-xs text-slate-500">Fresh notes and examination uploads</p>
            </div>
          </div>
          <Link
            href="/library?sortBy=newest"
            className="text-xs font-bold text-lpu-600 hover:text-lpu-700 flex items-center gap-1"
          >
            View More <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentlyAdded.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recentlyAdded.map((mat) => (
              <MaterialCard
                key={mat.id}
                material={mat}
                allowDownloads={allowDownloads}
                isAdmin={Boolean(user?.isAdmin || user?.isOwner)}
                onPreview={(m) => setPreviewMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500">No study materials available yet.</p>
          </div>
        )}
      </section>

      {/* Most Downloaded Resources */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Most Downloaded by LPU Students
              </h2>
              <p className="text-xs text-slate-500">Highest-rated study materials across university batches</p>
            </div>
          </div>
          <Link
            href="/library?sortBy=downloads"
            className="text-xs font-bold text-lpu-600 hover:text-lpu-700 flex items-center gap-1"
          >
            View Top Downloaded <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {mostDownloaded.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {mostDownloaded.map((mat) => (
              <MaterialCard
                key={mat.id}
                material={mat}
                allowDownloads={allowDownloads}
                isAdmin={Boolean(user?.isAdmin || user?.isOwner)}
                onPreview={(m) => setPreviewMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500">No downloads recorded yet.</p>
          </div>
        )}
      </section>

      {/* Recommended Mid-Term Resources */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Recommended For Mid-Term Revisions
              </h2>
              <p className="text-xs text-slate-500">Solved question sets and marking scheme blueprints</p>
            </div>
          </div>
          <Link
            href="/library?type=Mid-Term"
            className="text-xs font-bold text-lpu-600 hover:text-lpu-700 flex items-center gap-1"
          >
            All Mid-Term Sets <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recommended.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recommended.map((mat) => (
              <MaterialCard
                key={mat.id}
                material={mat}
                allowDownloads={allowDownloads}
                isAdmin={Boolean(user?.isAdmin || user?.isOwner)}
                onPreview={(m) => setPreviewMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500">No mid-term resources published yet.</p>
          </div>
        )}
      </section>

      {/* PDF In-browser Preview Modal */}
      <DocumentViewerModal
        material={previewMaterial}
        allowDownloads={allowDownloads}
        isAdminOrOwner={Boolean(user?.isAdmin || user?.isOwner)}
        onClose={() => setPreviewMaterial(null)}
      />

    </div>
  );
}
