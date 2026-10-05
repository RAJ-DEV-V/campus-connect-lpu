'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  Clock, 
  Sparkles, 
  Search, 
  ArrowRight,
  GraduationCap,
  Bookmark,
  Bell,
  Layers,
  ChevronRight,
  Calendar,
  CheckCircle2,
  HardDrive,
  ExternalLink,
  Flame,
  FileText,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Award,
  BarChart3,
  Edit3,
  UserCheck
} from 'lucide-react';
import MaterialCard, { formatYearName } from '@/components/MaterialCard';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import { Material, WhatsNewItem, MaterialOpenHistoryItem, SavedMaterialItem } from '@/lib/db/types';

export default function DashboardPage() {
  const router = useRouter();

  // User state
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Setup / Edit Profile Modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileYear, setProfileYear] = useState<number>(1);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Dashboard Data State
  const [whatsNewList, setWhatsNewList] = useState<WhatsNewItem[]>([]);
  const [historyList, setHistoryList] = useState<(MaterialOpenHistoryItem & { material: Material })[]>([]);
  const [savedMaterialsList, setSavedMaterialsList] = useState<(SavedMaterialItem & { material: Material })[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [recommendedMaterials, setRecommendedMaterials] = useState<Material[]>([]);
  const [recentlyAddedMaterials, setRecentlyAddedMaterials] = useState<Material[]>([]);

  // System & View Modal state
  const [allowDownloads, setAllowDownloads] = useState<boolean>(true);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Activity summary stats
  const [totalNewCount, setTotalNewCount] = useState<number>(0);

  // Time-based greeting helper
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Fetch all personalized dashboard data
  const loadDashboardData = useCallback(async (currentYear?: number) => {
    try {
      // 1. Fetch current authenticated user
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

      const currentUser = userData.user;
      setUser(currentUser);
      setProfileName(currentUser.name || '');
      setProfileYear(currentUser.year || 1);

      // Check if profile setup is required (first-time student profile setup)
      const isProfileIncomplete = !currentUser.name || !currentUser.year;
      if (isProfileIncomplete) {
        setShowProfileModal(true);
      }

      const activeYear = currentYear || currentUser.year || 1;

      // 2. Fetch Global Access Settings
      try {
        const settingsRes = await fetch('/api/admin/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.settings && typeof settingsData.settings.allow_user_downloads === 'boolean') {
            setAllowDownloads(settingsData.settings.allow_user_downloads);
          }
        }
      } catch (settingsErr) {
        console.warn('Could not load global settings on dashboard:', settingsErr);
      }

      // 3. Fetch What's New Announcements
      try {
        const wnRes = await fetch('/api/whats-new');
        if (wnRes.ok) {
          const wnData = await wnRes.json();
          if (wnData.success && Array.isArray(wnData.items)) {
            setWhatsNewList(wnData.items);
          }
        }
      } catch (wnErr) {
        console.warn('Could not load whats_new:', wnErr);
      }

      // 4. Fetch Continue Studying History (Material Open History)
      try {
        const histRes = await fetch('/api/materials/history?limit=8');
        if (histRes.ok) {
          const histData = await histRes.json();
          if (histData.success && Array.isArray(histData.history)) {
            setHistoryList(histData.history);
          }
        }
      } catch (histErr) {
        console.warn('Could not load material open history:', histErr);
      }

      // 5. Fetch Saved Materials (Bookmarks) & Saved IDs
      try {
        const [savedRes, savedIdsRes] = await Promise.all([
          fetch('/api/materials/saved?limit=12'),
          fetch('/api/materials/saved?idsOnly=true')
        ]);

        if (savedRes.ok) {
          const sData = await savedRes.json();
          if (sData.success && Array.isArray(sData.saved)) {
            setSavedMaterialsList(sData.saved);
          }
        }

        if (savedIdsRes.ok) {
          const idsData = await savedIdsRes.json();
          if (idsData.success && Array.isArray(idsData.savedIds)) {
            setSavedIds(new Set(idsData.savedIds));
          }
        }
      } catch (saveErr) {
        console.warn('Could not load saved materials:', saveErr);
      }

      // 6. Fetch Recommended Materials (Strictly filtered by student's academic year ONLY)
      try {
        const recRes = await fetch(`/api/materials?year=${activeYear}&sortBy=downloads&limit=6`);
        if (recRes.ok) {
          const recData = await recRes.json();
          // Strict year guard: NEVER allow another year's material into recommendations
          const yearOnlyRec = (recData.materials || []).filter((m: Material) => Number(m.year) === Number(activeYear));
          setRecommendedMaterials(yearOnlyRec);
        }
      } catch (recErr) {
        console.warn('Could not load recommendations:', recErr);
      }

      // 7. Fetch Recently Added Materials (Strictly filtered by student's academic year ONLY)
      try {
        const recentRes = await fetch(`/api/materials?year=${activeYear}&sortBy=newest&limit=6`);
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          // Strict year guard: NEVER allow another year's material into recently added
          const yearOnlyRecent = (recentData.materials || []).filter((m: Material) => Number(m.year) === Number(activeYear));
          setRecentlyAddedMaterials(yearOnlyRecent);
          setTotalNewCount(yearOnlyRecent.length);
        }
      } catch (recentErr) {
        console.warn('Could not load recently added:', recentErr);
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Profile Save (First-time or Edit)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    if (!profileName.trim()) {
      setProfileError('Please enter your name.');
      return;
    }
    if (![1, 2, 3, 4].includes(profileYear)) {
      setProfileError('Please select a valid academic year (1st to 4th Year).');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          year: profileYear,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setShowProfileModal(false);
      // Reload dashboard data with the newly selected year
      await loadDashboardData(profileYear);
    } catch (err: any) {
      setProfileError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Toggle bookmark save / unsave
  const handleToggleSave = async (material: Material) => {
    try {
      const res = await fetch('/api/materials/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: material.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (data.saved) {
            next.add(material.id);
          } else {
            next.delete(material.id);
          }
          return next;
        });

        // Update local saved list
        if (data.saved) {
          setSavedMaterialsList((prev) => [
            {
              id: `sm_${Date.now()}`,
              user_id: user?.id,
              material_id: material.id,
              saved_at: new Date().toISOString(),
              material,
            },
            ...prev.filter((item) => item.material_id !== material.id),
          ]);
        } else {
          setSavedMaterialsList((prev) => prev.filter((item) => item.material_id !== material.id));
        }
      }
    } catch (err) {
      console.warn('Failed to toggle bookmark:', err);
    }
  };

  // Open material in existing DocumentViewerModal and refresh history
  const handleOpenMaterial = (material: Material) => {
    setPreviewMaterial(material);
    // Optimistically update continue studying history
    setHistoryList((prev) => {
      const filtered = prev.filter((h) => h.material_id !== material.id);
      return [
        {
          id: `moh_${Date.now()}`,
          user_id: user?.id,
          material_id: material.id,
          opened_at: new Date().toISOString(),
          material,
        },
        ...filtered,
      ].slice(0, 8);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?search=${encodeURIComponent(searchQuery.trim())}&year=${user?.year || 1}`);
    } else {
      router.push(`/library?year=${user?.year || 1}`);
    }
  };

  // Human-readable relative time helper
  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  // Badge stylings for What's New announcements
  const getAnnouncementBadge = (type: string) => {
    switch (type) {
      case 'new_material':
        return { label: 'Study Material', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: BookOpen };
      case 'update':
        return { label: 'Update', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Sparkles };
      case 'important':
        return { label: 'Important', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertCircle };
      default:
        return { label: 'Announcement', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: Bell };
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-lpu-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Personalizing your Campus Connect workspace...</p>
      </div>
    );
  }

  const studentName = user?.name || 'Student';
  const studentYear = user?.year || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">

      {/* ======================================================== */}
      {/* 1. PERSONALIZED HEADER & ACADEMIC PROFILE                 */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 academic-grid-pattern opacity-10 pointer-events-none hidden md:block" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Verified LPU Member • Campus Connect 2.0
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {greeting}, {studentName} 👋
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-300">
              Your personalized study space.
            </p>

            {/* Quick In-Library Search */}
            <form onSubmit={handleSearchSubmit} className="mt-5 max-w-lg flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${formatYearName(studentYear)} subjects, PYQs, notes...`}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-400 text-xs focus:outline-none focus:border-lpu-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-lpu-600 hover:bg-lpu-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
              >
                Search
              </button>
            </form>
          </div>

          {/* Compact Academic Profile Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shrink-0 min-w-[260px] shadow-lg backdrop-blur-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Academic Profile
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                title="Change name or academic year"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-700/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Student Name:</span>
                <span className="font-bold text-white truncate max-w-[150px]">{studentName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Academic Year:</span>
                <span className="font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  {formatYearName(studentYear)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Account Status:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. 🔥 CONTINUE STUDYING (Priority #2: Most Important)    */}
      {/* ======================================================== */}
      <section className="bg-white/80 rounded-3xl p-6 sm:p-7 border border-orange-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5 fill-orange-500 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>🔥 Continue Studying</span>
                {historyList.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                    {historyList.length} recent
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">Pick up right where you left off — 1-click continuation without searching</p>
            </div>
          </div>
        </div>

        {historyList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {historyList.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border-2 border-slate-200/90 hover:border-orange-400 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 mt-0.5 border border-orange-200/60">
                      <FileText className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-orange-600 transition-colors line-clamp-2">
                        {item.material.title}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-slate-700">{item.material.subject_code}</span>
                        <span>•</span>
                        <span>{item.material.material_type}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Opened {formatTimeAgo(item.opened_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenMaterial(item.material)}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-orange-600 text-white font-bold text-xs transition-colors shadow-xs active:scale-95"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-orange-50/30 rounded-2xl border border-dashed border-orange-200 p-8 text-center">
            <BookOpen className="w-8 h-8 text-orange-400 mx-auto mb-2 opacity-70" />
            <p className="text-xs font-bold text-slate-700">Nothing here yet.</p>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
              Open a study material from the Study Library and it will appear here for instant 1-click continuation.
            </p>
            <Link
              href={`/library?year=${studentYear}`}
              className="inline-flex items-center gap-1.5 mt-3.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Explore {formatYearName(studentYear)} Materials <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 3. 🎯 YEAR-SPECIFIC RECOMMENDATIONS (Priority #3)         */}
      {/* ======================================================== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>🎯 Recommended For You</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  {formatYearName(studentYear)} ONLY
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Materials specifically curated for <span className="font-bold text-slate-700">{formatYearName(studentYear)}</span> — no other years mixed in
              </p>
            </div>
          </div>
          <Link
            href={`/library?year=${studentYear}`}
            className="text-xs font-bold text-lpu-600 hover:text-lpu-700 flex items-center gap-1"
          >
            Explore All {formatYearName(studentYear)} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recommendedMaterials.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recommendedMaterials.map((mat) => (
              <MaterialCard
                key={mat.id}
                material={mat}
                allowDownloads={allowDownloads}
                isAdmin={Boolean(user?.isAdmin || user?.isOwner)}
                isSaved={savedIds.has(mat.id)}
                onToggleSave={handleToggleSave}
                onPreview={(m) => handleOpenMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500">
              No recommended materials found for {formatYearName(studentYear)} yet.
            </p>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 4. 🆕 WHAT'S NEW (Announcements & Updates)                */}
      {/* ======================================================== */}
      {whatsNewList.length > 0 && (
        <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                <Bell className="w-4 h-4 text-purple-700" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>🆕 What&apos;s New</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {whatsNewList.length} updates
                  </span>
                </h2>
                <p className="text-xs text-slate-500">Official Campus Connect announcements and curriculum updates</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatsNewList.map((item) => {
              const badgeInfo = getAnnouncementBadge(item.type);
              const BadgeIcon = badgeInfo.icon;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-purple-200 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeInfo.bg}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badgeInfo.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  {item.link_target && (
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-end">
                      <Link
                        href={item.link_target}
                        className="text-xs font-bold text-lpu-600 hover:text-lpu-700 inline-flex items-center gap-1 group"
                      >
                        View Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 5. 🆕 RECENTLY ADDED (Year Filtered)                     */}
      {/* ======================================================== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  🆕 Recently Added
                </h2>
                {totalNewCount > 0 && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {totalNewCount} new in {formatYearName(studentYear)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Fresh notes and examination uploads</p>
            </div>
          </div>
          <Link
            href={`/library?year=${studentYear}&sortBy=newest`}
            className="text-xs font-bold text-lpu-600 hover:text-lpu-700 flex items-center gap-1"
          >
            View All ({totalNewCount}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentlyAddedMaterials.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentlyAddedMaterials.map((mat) => (
              <MaterialCard
                key={mat.id}
                material={mat}
                allowDownloads={allowDownloads}
                isAdmin={Boolean(user?.isAdmin || user?.isOwner)}
                isSaved={savedIds.has(mat.id)}
                onToggleSave={handleToggleSave}
                onPreview={(m) => handleOpenMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500">No recent uploads for this academic year yet.</p>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 6. 📌 SAVED MATERIALS (Bookmarks)                        */}
      {/* ======================================================== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Bookmark className="w-4 h-4 fill-blue-600 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                📌 Saved Materials
              </h2>
              <p className="text-xs text-slate-500">Your bookmarked study materials for quick revision</p>
            </div>
          </div>
        </div>

        {savedMaterialsList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedMaterialsList.map((item) => (
              <MaterialCard
                key={item.id}
                material={item.material}
                allowDownloads={allowDownloads}
                isAdmin={Boolean(user?.isAdmin || user?.isOwner)}
                isSaved={true}
                onToggleSave={handleToggleSave}
                onPreview={(m) => handleOpenMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Bookmark className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-semibold text-slate-600">No saved materials yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click the bookmark icon on any material card to save it for easy access anytime.
            </p>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 7. 📊 FACTUAL ACTIVITY SUMMARY                           */}
      {/* ======================================================== */}
      <section className="bg-slate-50 rounded-3xl p-6 sm:p-7 border border-slate-200/90">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Activity Summary
            </h2>
            <p className="text-xs text-slate-500">Your factual Campus Connect usage records</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Materials Opened</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{historyList.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Distinct documents viewed</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Saved Bookmarks</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{savedMaterialsList.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Materials pinned to your library</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Available in Your Year</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalNewCount}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Resources for {formatYearName(studentYear)}</p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 8. 📚 STUDY LIBRARY SHORTCUT                             */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
        <div>
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
            Explore Full Campus Library
          </span>
          <h3 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Looking for something else?
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Browse the complete Study Library across all academic years, subjects, mid-term sets, and PYQ blueprints.
          </p>
        </div>
        <Link
          href={`/library?year=${studentYear}`}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 transition-all shrink-0 flex items-center gap-2"
        >
          Open Study Library <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 9. FIRST-TIME & EDIT PROFILE MODAL                       */}
      {/* ======================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 mx-auto flex items-center justify-center mb-3">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Let&apos;s personalize your Campus Connect experience 🎓
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                Tell us your academic year so we can deliver tailored study materials, recommendations, and past question papers.
              </p>
            </div>

            {profileError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-lpu-500 focus:ring-2 focus:ring-lpu-500/20 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Academic Year
                </label>
                <select
                  value={profileYear}
                  onChange={(e) => setProfileYear(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-lpu-500 focus:ring-2 focus:ring-lpu-500/20 font-medium bg-white"
                >
                  <option value={1}>1st Year (Freshmen)</option>
                  <option value={2}>2nd Year (Core)</option>
                  <option value={3}>3rd Year (Specialization)</option>
                  <option value={4}>4th Year (Capstone & Placements)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-3">
                {/* Allow closing only if profile is already complete */}
                {user?.name && user?.year && (
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Continue →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. REUSED DOCUMENT VIEWER MODAL                         */}
      {/* ======================================================== */}
      <DocumentViewerModal
        material={previewMaterial}
        allowDownloads={allowDownloads}
        isAdminOrOwner={Boolean(user?.isAdmin || user?.isOwner)}
        onClose={() => setPreviewMaterial(null)}
      />

    </div>
  );
}
