'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  Filter, 
  BookOpen, 
  FileSpreadsheet, 
  Award, 
  HelpCircle, 
  Layers, 
  X, 
  Check, 
  DownloadCloud, 
  SlidersHorizontal,
  ChevronRight,
  FolderOpen,
  GraduationCap
} from 'lucide-react';
import MaterialCard, { formatYearName } from '@/components/MaterialCard';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import { Material, MaterialType } from '@/lib/db/types';

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State from URL params or defaults
  const initialYear = searchParams.get('year') 
    ? parseInt(searchParams.get('year')!, 10) 
    : searchParams.get('sem') 
      ? Math.ceil(parseInt(searchParams.get('sem')!, 10) / 2)
      : 0;

  const initialType = searchParams.get('type') || 'All';
  const initialSubject = searchParams.get('subject') || 'All';
  const initialSearch = searchParams.get('search') || '';

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedType, setSelectedType] = useState<string>(initialType);
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [sortBy, setSortBy] = useState<'newest' | 'downloads' | 'title'>('newest');

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [allowDownloads, setAllowDownloads] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Sync state if URL changes
  useEffect(() => {
    const yr = searchParams.get('year');
    if (yr) setSelectedYear(parseInt(yr, 10));

    const tp = searchParams.get('type');
    if (tp) setSelectedType(tp);

    const sb = searchParams.get('subject');
    if (sb) setSelectedSubject(sb);

    const q = searchParams.get('search');
    if (q !== null) setSearchQuery(q);
  }, [searchParams]);

  // Fetch access mode settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setAllowDownloads(data.settings.allow_user_downloads);
          }
          if (typeof data.isAdmin === 'boolean') {
            setIsAdmin(data.isAdmin);
          }
        }
      } catch (err) {
        console.error('Failed to load access settings', err);
      }
    }
    fetchSettings();
  }, []);

  // Fetch materials whenever filters change
  useEffect(() => {
    async function fetchMaterials() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedYear > 0) params.set('year', selectedYear.toString());
        if (selectedType && selectedType !== 'All') params.set('material_type', selectedType);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (sortBy) params.set('sortBy', sortBy);

        const res = await fetch(`/api/materials?${params.toString()}`);
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (res.status === 403) {
          router.push('/community');
          return;
        }

        const data = await res.json();
        if (data.success) {
          setMaterials(data.materials || []);
        }
      } catch (err) {
        console.error('Failed to load materials', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchMaterials, 150);
    return () => clearTimeout(timer);
  }, [selectedYear, selectedType, searchQuery, sortBy, router]);

  // Extract unique subjects for the current selected Year to enable Year -> Subject hierarchy
  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    materials.forEach((m) => {
      if (selectedYear === 0 || m.year === selectedYear) {
        map.set(m.subject_code, `${m.subject_code} - ${m.subject}`);
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [materials, selectedYear]);

  // Filter by subject if specified
  const filteredMaterials = useMemo(() => {
    if (selectedSubject === 'All') return materials;
    return materials.filter((m) => m.subject_code === selectedSubject || m.subject === selectedSubject);
  }, [materials, selectedSubject]);

  const clearAllFilters = () => {
    setSelectedYear(0);
    setSelectedType('All');
    setSelectedSubject('All');
    setSearchQuery('');
    router.push('/library');
  };

  const categories = [
    { id: 'All', label: 'All Resources', icon: Layers },
    { id: 'Notes', label: 'Notes', icon: BookOpen },
    { id: 'Mid-Term', label: 'Mid-Term', icon: FileSpreadsheet },
    { id: 'End-Term', label: 'End-Term', icon: Award },
    { id: 'PYQs', label: 'PYQs', icon: HelpCircle },
  ];

  const yearTabs = [
    { year: 0, label: 'All Years' },
    { year: 1, label: '1st Year' },
    { year: 2, label: '2nd Year' },
    { year: 3, label: '3rd Year' },
    { year: 4, label: '4th Year' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      
      {/* Breadcrumb Navigation: Year → Subject → Material Type → File */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 overflow-x-auto pb-1">
        <span className="text-slate-900 flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5 text-lpu-600" /> Study Library
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className={selectedYear > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}>
          {selectedYear > 0 ? formatYearName(selectedYear) : 'All Years'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className={selectedSubject !== 'All' ? 'text-slate-900 font-bold text-lpu-600' : 'text-slate-500'}>
          {selectedSubject !== 'All' ? selectedSubject : 'All Subjects'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className={selectedType !== 'All' ? 'text-slate-900 font-bold' : 'text-slate-500'}>
          {selectedType !== 'All' ? selectedType : 'All Types'}
        </span>
      </nav>

      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Study Material Library
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse: <strong>Year → Subject → Material Type → File</strong>. Verified notes, mid-terms, and PYQs for LPU students.
          </p>
        </div>

        {/* Search Bar Input */}
        <div className="w-full md:w-80 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search (e.g. Programming in C, DSA, CSE101)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-lpu-500 focus:outline-none text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hierarchical Filters Control Bar: Year + Subject + Material Type */}
      <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        
        {/* Step 1: Year Filter Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-lpu-600" />
              1. Academic Year
            </span>
            {selectedYear > 0 && (
              <button
                onClick={() => {
                  setSelectedYear(0);
                  setSelectedSubject('All');
                }}
                className="text-[11px] font-semibold text-lpu-600 hover:underline"
              >
                Clear Year Selection
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {yearTabs.map((yt) => {
              const isSelected = selectedYear === yt.year;
              return (
                <button
                  key={yt.year}
                  onClick={() => {
                    setSelectedYear(yt.year);
                    setSelectedSubject('All');
                  }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-lpu-600 to-amber-500 text-white shadow-md shadow-orange-500/25 scale-[1.02]'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span className="text-sm font-extrabold">{yt.label}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                    {yt.year === 0 ? 'All 4 Years' : `Year ${yt.year}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Subject & Material Type Filter */}
        <div className="pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Material Type Pills */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. Material Type
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedType === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedType(cat.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Filter Dropdown & Sorting */}
          <div className="flex items-center gap-3 flex-wrap">
            {availableSubjects.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  3. Filter by Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-lpu-500"
                >
                  <option value="All">All Subjects ({availableSubjects.length})</option>
                  {availableSubjects.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-lpu-500"
              >
                <option value="newest">Recently Uploaded</option>
                <option value="downloads">Most Downloaded</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

        </div>

      </div>

      {/* Results Header Info */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>
          Showing <strong className="text-slate-900">{filteredMaterials.length}</strong> study materials
          {selectedYear > 0 && ` for ${formatYearName(selectedYear)}`}
          {selectedSubject !== 'All' && ` • ${selectedSubject}`}
          {selectedType !== 'All' && ` (${selectedType})`}
        </span>

        {(selectedYear > 0 || selectedType !== 'All' || searchQuery || selectedSubject !== 'All') && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-rose-600 hover:underline font-bold"
          >
            Reset All Filters
          </button>
        )}
      </div>

      {/* Materials Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-lpu-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-500">Fetching university materials...</p>
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredMaterials.map((mat) => (
            <MaterialCard
              key={mat.id}
              material={mat}
              allowDownloads={allowDownloads}
              isAdmin={isAdmin}
              onPreview={(m) => setPreviewMaterial(m)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">No Materials Found</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            We couldn&apos;t find study materials matching your current Year + Subject + Type selection.
          </p>
          <button
            onClick={clearAllFilters}
            className="mt-6 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
          >
            Reset Filters & View All
          </button>
        </div>
      )}

      {/* Embedded Document Viewer Modal */}
      <DocumentViewerModal
        material={previewMaterial}
        allowDownloads={allowDownloads}
        isAdminOrOwner={isAdmin}
        onClose={() => setPreviewMaterial(null)}
      />

    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-4 border-lpu-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading Study Library...</p>
      </div>
    }>
      <LibraryContent />
    </Suspense>
  );
}
