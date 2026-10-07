'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  BookOpen, 
  FileSpreadsheet, 
  Award, 
  HelpCircle, 
  Users, 
  ArrowRight, 
  Search, 
  Sparkles, 
  CheckCircle, 
  ShieldCheck, 
  DownloadCloud, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveStats, setLiveStats] = useState<{
    totalMaterials: number;
    totalUsers: number;
    totalDownloads: number;
    academicYears: number;
  }>({
    totalMaterials: 0,
    totalUsers: 0,
    totalDownloads: 0,
    academicYears: 4,
  });

  const [communityInviteUrl, setCommunityInviteUrl] = useState<string>(
    'https://chat.whatsapp.com/ElGakQUGGa1IMam5FlAiqw'
  );

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/stats/public');
        if (res.ok) {
          const d = await res.json();
          if (d.stats) setLiveStats(d.stats);
          if (d.communityInviteUrl) setCommunityInviteUrl(d.communityInviteUrl);
        }
      } catch (err) {}
    }
    loadStats();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/library');
    }
  };

  const categories = [
    {
      type: 'Notes',
      title: 'Subject Notes',
      icon: BookOpen,
      desc: 'Hand-crafted unit notes, lecture slides, code examples, and formula cheat-sheets.',
      badgeColor: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      type: 'Mid-Term',
      title: 'Mid-Term Papers',
      icon: FileSpreadsheet,
      desc: 'Past mid-term examination questions with step-by-step marking rubrics.',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      type: 'End-Term',
      title: 'End-Term Papers',
      icon: Award,
      desc: 'Previous end-term papers with detailed numerical solutions and code traces.',
      badgeColor: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      type: 'PYQs',
      title: 'Previous Year PYQs',
      icon: HelpCircle,
      desc: 'High-yield recurring questions categorized year-wise to maximize exam scores.',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  const academicYears = [
    {
      year: 1,
      title: '1st Year',
      subtitle: 'Freshmen Foundation',
      subjects: 'CSE101 (C), MTH108 (Maths-I), PHY110, INT108',
      desc: 'Foundational programming, engineering physics, calculus & python basics.',
      color: 'border-orange-200 dark:border-orange-900/60 hover:border-orange-400 dark:hover:border-orange-500 bg-orange-50/30 dark:bg-orange-950/20',
    },
    {
      year: 2,
      title: '2nd Year',
      subtitle: 'Core Engineering',
      subjects: 'CSE205 (DSA), CSE202 (C++), CSE316 (OS), CSE325 (DBMS)',
      desc: 'Data structures, object-oriented concepts, operating systems & database systems.',
      color: 'border-blue-200 dark:border-blue-900/60 hover:border-blue-400 dark:hover:border-blue-500 bg-blue-50/30 dark:bg-blue-950/20',
    },
    {
      year: 3,
      title: '3rd Year',
      subtitle: 'Advanced Specialization',
      subjects: 'CSE322 (TOC), CSE408 (DAA), CSE422 (AI/ML), CSE412',
      desc: 'Automata theory, algorithm design, artificial intelligence & compiler design.',
      color: 'border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20',
    },
    {
      year: 4,
      title: '4th Year',
      subtitle: 'Capstone & Placements',
      subjects: 'CSE492 (Deep Learning), CSE436 (Big Data), CSE489, Capstone',
      desc: 'Deep neural networks, distributed systems, big data analytics & capstone handbook.',
      color: 'border-purple-200 dark:border-purple-900/60 hover:border-purple-400 dark:hover:border-purple-500 bg-purple-50/30 dark:bg-purple-950/20',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50/70 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-12 pb-20 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="absolute inset-0 academic-grid-pattern opacity-60 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800/80 shadow-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-lpu-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Lovely Professional University • Student Academic Repository
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
            Campus Connect <span className="bg-gradient-to-r from-lpu-600 via-orange-600 to-amber-500 bg-clip-text text-transparent">LPU</span>
          </h1>

          <p className="mt-4 text-xl sm:text-2xl text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
            “Your centralized hub for LPU study materials.”
          </p>

          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            One single, organized library built for 2,000+ LPU students. Get instant, one-click access to verified subject notes, mid-term & end-term question papers, and past-year solved questions organized year-wise.
          </p>

          {/* Prominent CTA */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-base text-white bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 shadow-lg shadow-orange-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Get Study Material
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <a
              href={communityInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Join LPU Community
            </a>
          </div>

          {/* Search Bar */}
          <div className="mt-10 max-w-2xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject (e.g. Programming in C, Data Structures, CSE101)..."
                className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-lpu-500 dark:focus:border-orange-500 focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm shadow-sm transition-all"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-700 transition-colors shadow-xs"
              >
                Search
              </button>
            </form>
          </div>

          {/* Statistics Bar - Powered by Live Database Telemetry */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center">
              <div className="text-2xl sm:text-3xl font-black text-lpu-600 dark:text-orange-400">
                {liveStats.totalUsers > 0 ? liveStats.totalUsers : '—'}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">Verified Members</div>
            </div>
            <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {liveStats.totalMaterials > 0 ? liveStats.totalMaterials : '—'}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">Study Resources</div>
            </div>
            <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {liveStats.academicYears} Years
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">Curriculum Depth</div>
            </div>
            <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center">
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
                {liveStats.totalDownloads > 0 ? liveStats.totalDownloads : '—'}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">Verified Downloads</div>
            </div>
          </div>

        </div>
      </section>

      {/* Year-Wise Library Portals */}
      <section className="py-16 bg-slate-50 dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-bold text-lpu-600 dark:text-orange-400 uppercase tracking-wider bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/80 px-3 py-1 rounded-full">
                Year-Wise Library Structure
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
                Browse by Academic Year
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Browse: <strong>Year → Subject → Material Type → File</strong>
              </p>
            </div>
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-lpu-600 dark:text-orange-400 hover:text-lpu-700 dark:hover:text-orange-300"
            >
              Open Full Library Directory <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {academicYears.map((y) => (
              <Link
                key={y.year}
                href={`/library?year=${y.year}`}
                className={`rounded-2xl border p-6 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between ${y.color} bg-white dark:bg-slate-900/90 dark:border-slate-800`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {y.subtitle}
                    </span>
                    <span className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-black text-sm">
                      {y.year}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-lpu-600 dark:group-hover:text-orange-400 transition-colors">
                    {y.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    {y.desc}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Featured Subjects:
                    </span>
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-snug">
                      {y.subjects}
                    </p>
                  </div>
                </div>

                <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-lpu-600 dark:text-orange-400 group-hover:underline">
                  Browse {y.title} Resources <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Core Material Types */}
      <section className="py-16 bg-white dark:bg-slate-950 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Four Core Academic Categories
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Every subject contains high-yield notes, solved mid-terms, final end-term papers, and question banks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.type}
                  className="bg-slate-50/70 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-500/50 p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center ${cat.iconColor} shadow-xs`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${cat.badgeColor}`}>
                        {cat.type}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>

                  <Link
                    href={`/library?type=${cat.type}`}
                    className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-lpu-600 dark:text-orange-400 hover:text-lpu-700 dark:hover:text-orange-300 transition-colors"
                  >
                    Explore {cat.title} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3 Step Walkthrough */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              How Access Works in 3 Quick Steps
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Designed to facilitate seamless, verified academic resource sharing for Lovely Professional University students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-lg mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                1-Click Google Sign-In
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in smoothly with your Google / LPU account. No long registration forms or tedious password creation required.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Join LPU Community
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Join our student WhatsApp / Telegram group to receive real-time exam notifications, paper leaks discussions, and study alerts.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-lg mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Instant Library Unlock
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Confirm your membership with one click to permanently unlock the full 4-year library with instant 1-click downloads.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all"
            >
              Get Started Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
