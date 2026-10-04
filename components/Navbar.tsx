'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  BookOpen, 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  community_joined: boolean;
  isAdmin: boolean;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      // 1. Call server-side logout to clear session and Supabase cookies
      await fetch('/api/auth/logout', { method: 'POST' });

      // 2. Invalidate Supabase client session if available
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (clientErr) {
        // Silently continue if client is not configured
      }

      // 3. Purge browser client-side storage
      try {
        if (typeof window !== 'undefined') {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
              localStorage.removeItem(key);
            }
          });
          sessionStorage.clear();
        }
      } catch (storageErr) {}

      setUser(null);

      // 4. Hard navigate to /login to flush all React and router state
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout error', e);
      window.location.href = '/login';
    }
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: GraduationCap },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { href: '/library', label: 'Study Library', icon: BookOpen, requiresAuth: true },
    { href: '/community', label: 'Community', icon: Users, requiresAuth: true },
  ];

  if (user?.isAdmin) {
    navLinks.push({ href: '/admin', label: 'Admin Panel', icon: ShieldCheck, requiresAuth: true });
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Brand Logo & Wordmark */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-lpu-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                  Campus Connect <span className="text-lpu-600">LPU</span>
                </span>
                <span className="hidden md:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                  LPU Portal
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium -mt-0.5 hidden sm:block">
                Centralized Study Material Hub
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              if (link.requiresAuth && !user) return null;
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-orange-50 text-lpu-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-lpu-600' : 'text-slate-400'}`} />
                  {link.label}
                  {link.href === '/admin' && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded">
                      Admin
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action / Profile */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full hover:bg-slate-100 border border-slate-200/80 transition-all focus:outline-none"
                >
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-orange-200 object-cover bg-orange-50"
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-800 leading-tight">
                      {user.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[110px]">
                      {user.email}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {user.community_joined ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Community Member
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Join Community Required
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <LayoutDashboard className="w-4 h-4 text-slate-400" />
                        My Dashboard
                      </Link>
                      <Link
                        href="/library"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        Browse Study Materials
                      </Link>
                      {user.isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <ShieldCheck className="w-4 h-4 text-red-500" />
                          Admin Portal
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : !loading ? (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 shadow-sm shadow-orange-500/30 transition-all active:scale-98 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  Get Study Material
                </Link>
              </div>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {!loading && user && (
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-orange-200"
              />
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2">
          {user && (
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border border-orange-200"
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <div className="mt-1">
                    {user.community_joined ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Community Member ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Join Community Required
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {navLinks.map((link) => {
              if (link.requiresAuth && !user) return null;
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                    isActive ? 'bg-orange-50 text-lpu-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-lpu-600' : 'text-slate-400'}`} />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100">
            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-bold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-bold text-white bg-gradient-to-r from-lpu-600 to-amber-500 rounded-lg shadow-sm"
                >
                  Get Study Material
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
