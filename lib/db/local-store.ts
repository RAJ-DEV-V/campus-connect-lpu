import fs from 'fs';
import path from 'path';
import { 
  User, 
  Material, 
  Download, 
  Admin, 
  AdminStats, 
  MaterialFilters, 
  CommunityVerificationLink,
  WhatsNewItem,
  MaterialOpenHistoryItem,
  SavedMaterialItem,
  StudentFeedbackRequest,
  FeedbackRequestStatus
} from './types';
import { generateSamplePdf } from '../pdf-generator';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

interface DatabaseSchema {
  users: User[];
  materials: Material[];
  downloads: Download[];
  admins: Admin[];
  community_verification_links: CommunityVerificationLink[];
  whats_new?: WhatsNewItem[];
  material_open_history?: MaterialOpenHistoryItem[];
  saved_materials?: SavedMaterialItem[];
  feedback_requests?: StudentFeedbackRequest[];
  app_settings?: {
    allow_user_downloads: boolean;
    updated_at?: string;
    updated_by?: string;
  };
}

function getDefaultData(): DatabaseSchema {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const twelveDaysAgo = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString();
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

  const community_verification_links: CommunityVerificationLink[] = [];

  const users: User[] = [
    {
      id: 'b8b62eee-0e01-4163-9123-ab931e254027',
      name: 'RAJVANSH MISHRA',
      email: 'mishra.rajvansh11@gmail.com',
      avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocJyb9oN_ZcToffuuEiGwaa7suNwrweCYI9iU0GXGBCZjQEZtQ=s96-c',
      community_joined: true,
      created_at: now.toISOString(),
      last_login: now.toISOString(),
      last_active_at: now.toISOString(),
    },
  ];

  const admins: Admin[] = [
    {
      id: 'e24e8988-170d-4553-8ce7-129d97c6165f',
      user_id: 'b8b62eee-0e01-4163-9123-ab931e254027',
      email: 'mishra.rajvansh11@gmail.com',
      role: 'owner',
      created_at: '2026-07-01T09:00:00.000Z',
    },
  ];

  const materials: Material[] = [];

  const downloads: Download[] = [];

  const app_settings = {
    allow_user_downloads: true,
    updated_at: new Date().toISOString(),
    updated_by: 'system',
  };

  const whats_new: WhatsNewItem[] = [];
  const material_open_history: MaterialOpenHistoryItem[] = [];
  const saved_materials: SavedMaterialItem[] = [];

  return { 
    users, 
    materials, 
    downloads, 
    admins, 
    community_verification_links, 
    whats_new,
    material_open_history,
    saved_materials,
    app_settings 
  };
}

export class LocalDatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.ensureSamplePdfs();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.community_verification_links) {
            parsed.community_verification_links = getDefaultData().community_verification_links;
          }
          if (!parsed.whats_new) {
            parsed.whats_new = [];
          }
          if (!parsed.material_open_history) {
            parsed.material_open_history = [];
          }
          if (!parsed.saved_materials) {
            parsed.saved_materials = [];
          }
          if (!parsed.app_settings) {
            parsed.app_settings = getDefaultData().app_settings;
          }
          if (!parsed.admins) {
            parsed.admins = getDefaultData().admins;
          } else {
            const hasOwner = parsed.admins.some((a: any) => a.email?.toLowerCase() === 'mishra.rajvansh11@gmail.com');
            if (!hasOwner) {
              parsed.admins.unshift({
                id: 'adm_owner_rajvansh',
                user_id: 'usr_owner_rajvansh',
                email: 'mishra.rajvansh11@gmail.com',
                role: 'owner',
                created_at: '2026-07-01T09:00:00.000Z',
              });
            }
          }
          if (!parsed.materials) {
            parsed.materials = [];
          }
          if (!parsed.downloads) {
            parsed.downloads = [];
          }
          if (!parsed.users) {
            parsed.users = getDefaultData().users;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading db.json, initializing fresh store', e);
    }
    const initial = getDefaultData();
    this.save(initial);
    return initial;
  }

  private save(data?: DatabaseSchema) {
    try {
      const payload = data || this.data;
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving db.json', e);
    }
  }

  private async ensureSamplePdfs() {
    for (const mat of this.data.materials) {
      if (mat.file_url.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', mat.file_url.replace('/uploads/', 'uploads/'));
        if (!fs.existsSync(localPath)) {
          try {
            await generateSamplePdf({
              title: mat.title,
              subject: mat.subject,
              subjectCode: mat.subject_code,
              year: mat.year,
              materialType: mat.material_type,
              description: mat.description,
              outputPath: localPath,
            });
          } catch (err) {
            console.error('Error creating sample PDF for:', mat.title, err);
          }
        }
      }
    }
  }

  // --- Users ---
  getUserById(id: string): User | null {
    return this.data.users.find((u) => u.id === id) || null;
  }

  getUserByEmail(email: string): User | null {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  upsertUser(userData: { id: string; name: string; email: string; avatar_url?: string; community_joined?: boolean; year?: number | null }): User {
    const existingIndex = this.data.users.findIndex((u) => u.id === userData.id || u.email.toLowerCase() === userData.email.toLowerCase());
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = this.data.users[existingIndex];
      // ONE-TIME VERIFICATION: Once verified, community_joined stays TRUE unless explicitly revoked
      const shouldKeepVerified = existing.community_joined === true;
      const finalJoined = shouldKeepVerified 
        ? true 
        : (userData.community_joined !== undefined ? userData.community_joined : existing.community_joined);

      const finalYear = (userData.year !== undefined && userData.year !== null)
        ? userData.year
        : (existing.year ?? null);

      const updated: User = {
        ...existing,
        name: userData.name || existing.name,
        avatar_url: userData.avatar_url || existing.avatar_url,
        community_joined: finalJoined,
        year: finalYear,
        profile_completed: Boolean((userData.name || existing.name) && finalYear),
        last_login: now,
        last_active_at: now,
      };
      this.data.users[existingIndex] = updated;
      this.save();
      return updated;
    } else {
      const newUser: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.name)}`,
        community_joined: userData.community_joined ?? false,
        year: userData.year ?? null,
        profile_completed: Boolean(userData.name && userData.year),
        created_at: now,
        last_login: now,
        last_active_at: now,
      };
      this.data.users.push(newUser);
      this.save();
      return newUser;
    }
  }

  updateUserProfile(userId: string, data: { name?: string; year?: number }): User | null {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;
    if (data.name && data.name.trim()) {
      user.name = data.name.trim();
    }
    if (data.year !== undefined && [1, 2, 3, 4].includes(data.year)) {
      user.year = data.year;
    }
    user.profile_completed = Boolean(user.name && user.year);
    user.last_active_at = new Date().toISOString();
    this.save();
    return user;
  }

  touchUserActivity(userId: string): void {
    const user = this.data.users.find((u) => u.id === userId);
    if (user) {
      const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;
      const nowTime = Date.now();
      // Throttle: update at most once every 2 minutes
      if (nowTime - lastActive > 2 * 60 * 1000) {
        user.last_active_at = new Date(nowTime).toISOString();
        this.save();
      }
    }
  }

  updateCommunityJoined(
    userId: string, 
    joined: boolean, 
    linkId?: string | null
  ): User | null {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;
    const now = new Date().toISOString();
    user.community_joined = joined;
    user.last_active_at = now;
    if (joined) {
      user.community_verified_at = now;
      if (linkId) {
        user.community_verification_link_id = linkId;
      }
    } else {
      user.community_verified_at = null;
      user.community_verification_link_id = null;
    }
    this.save();
    return user;
  }

  // --- Community Verification Links ---
  getCommunityVerificationLinks(): CommunityVerificationLink[] {
    const links = this.data.community_verification_links || [];
    return links.map((link) => {
      const verifiedCount = this.data.users.filter(
        (u) => u.community_joined && u.community_verification_link_id === link.id
      ).length;
      return {
        ...link,
        verified_count: verifiedCount,
      };
    });
  }

  getCommunityVerificationLinkById(id: string): CommunityVerificationLink | null {
    const link = (this.data.community_verification_links || []).find((l) => l.id === id);
    if (!link) return null;
    const verifiedCount = this.data.users.filter(
      (u) => u.community_joined && u.community_verification_link_id === link.id
    ).length;
    return { ...link, verified_count: verifiedCount };
  }

  findActiveLinkByCode(inviteCode: string): CommunityVerificationLink | null {
    const normalized = inviteCode.trim().toLowerCase();
    const link = (this.data.community_verification_links || []).find(
      (l) => l.is_active && l.invite_code.trim().toLowerCase() === normalized
    );
    return link || null;
  }

  getActiveCommunityInviteUrl(): string {
    const active = (this.data.community_verification_links || []).find((l) => l.is_active);
    return active ? active.invite_url : 'https://chat.whatsapp.com/campus-connect-lpu-2026';
  }

  createCommunityVerificationLink(data: {
    name: string;
    invite_url: string;
    invite_code: string;
    type: 'community' | 'freshers_group' | 'other';
    is_active?: boolean;
    created_by?: string;
  }): CommunityVerificationLink {
    const now = new Date().toISOString();
    const newLink: CommunityVerificationLink = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name,
      invite_url: data.invite_url,
      invite_code: data.invite_code,
      type: data.type,
      is_active: data.is_active ?? true,
      created_at: now,
      updated_at: now,
      created_by: data.created_by || 'admin',
      verified_count: 0,
    };
    if (!this.data.community_verification_links) {
      this.data.community_verification_links = [];
    }
    this.data.community_verification_links.unshift(newLink);
    this.save();
    return newLink;
  }

  updateCommunityVerificationLink(
    id: string,
    updates: Partial<Pick<CommunityVerificationLink, 'name' | 'invite_url' | 'invite_code' | 'type' | 'is_active'>>
  ): CommunityVerificationLink | null {
    const index = (this.data.community_verification_links || []).findIndex((l) => l.id === id);
    if (index === -1) return null;
    const existing = this.data.community_verification_links[index];
    const updated: CommunityVerificationLink = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.community_verification_links[index] = updated;
    this.save();
    return updated;
  }

  deleteCommunityVerificationLink(id: string): boolean {
    const initialLen = (this.data.community_verification_links || []).length;
    this.data.community_verification_links = (this.data.community_verification_links || []).filter(
      (l) => l.id !== id
    );
    if (this.data.community_verification_links.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  revokeUsersVerifiedViaLink(linkId: string): number {
    let count = 0;
    this.data.users.forEach((u) => {
      if (u.community_verification_link_id === linkId) {
        u.community_joined = false;
        u.community_verified_at = null;
        u.community_verification_link_id = null;
        count++;
      }
    });
    if (count > 0) {
      this.save();
    }
    return count;
  }

  getAllUsers(): User[] {
    return [...this.data.users].sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
  }

  // --- Admins & Role System ---
  getUserRole(userIdOrEmail: string): 'owner' | 'admin' | 'user' {
    const term = userIdOrEmail.toLowerCase();
    if (term === 'mishra.rajvansh11@gmail.com') return 'owner';
    const foundAdmin = this.data.admins.find((a) => a.user_id === userIdOrEmail || a.email.toLowerCase() === term);
    if (foundAdmin) return foundAdmin.role;
    const foundUser = this.data.users.find((u) => u.id === userIdOrEmail || u.email.toLowerCase() === term);
    if (foundUser?.role) return foundUser.role;
    return 'user';
  }

  isAdmin(userIdOrEmail: string): boolean {
    const role = this.getUserRole(userIdOrEmail);
    return role === 'owner' || role === 'admin';
  }

  isOwner(userIdOrEmail: string): boolean {
    return this.getUserRole(userIdOrEmail) === 'owner';
  }

  getAdmins(): Admin[] {
    return [...this.data.admins];
  }

  addAdmin(email: string, role: 'owner' | 'admin' = 'admin', userId?: string): Admin {
    const cleanEmail = email.toLowerCase().trim();
    const existing = this.data.admins.find((a) => a.email.toLowerCase() === cleanEmail);
    if (existing) {
      existing.role = role;
      if (userId) existing.user_id = userId;
      this.save();
      return existing;
    }
    const newAdmin: Admin = {
      id: `adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      email: cleanEmail,
      role,
      created_at: new Date().toISOString(),
    };
    this.data.admins.push(newAdmin);
    
    // Also update user profile role if user exists
    const user = this.data.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.role = role;
    }
    this.save();
    return newAdmin;
  }

  removeAdmin(adminIdOrEmail: string): boolean {
    const clean = adminIdOrEmail.toLowerCase().trim();
    // OWNER PROTECTION: mishra.rajvansh11@gmail.com and usr_owner_rajvansh CANNOT be removed!
    if (
      clean === 'mishra.rajvansh11@gmail.com' ||
      clean === 'usr_owner_rajvansh' ||
      clean === 'adm_owner_rajvansh'
    ) {
      throw new Error('Owner account privileges cannot be removed.');
    }
    const target = this.data.admins.find(
      (a) => a.id === adminIdOrEmail || a.user_id === adminIdOrEmail || a.email.toLowerCase() === clean
    );
    if (!target) return false;
    if (
      target.email.toLowerCase() === 'mishra.rajvansh11@gmail.com' ||
      target.role === 'owner' ||
      target.user_id === 'usr_owner_rajvansh'
    ) {
      throw new Error('Owner account cannot be removed.');
    }
    this.data.admins = this.data.admins.filter((a) => a.id !== target.id);
    
    const user = this.data.users.find((u) => u.email.toLowerCase() === target.email.toLowerCase());
    if (user) {
      user.role = 'user';
    }
    this.save();
    return true;
  }

  revokeUserCommunityAccess(userId: string): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    user.community_joined = false;
    user.community_verified_at = null;
    user.community_verification_link_id = null;
    this.save();
    return true;
  }

  // --- Materials ---
  getMaterials(filters: MaterialFilters = {}): { materials: Material[]; total: number } {
    let result = [...this.data.materials];

    if (filters.year && filters.year > 0) {
      result = result.filter((m) => m.year === Number(filters.year));
    }

    if (filters.material_type && filters.material_type !== 'All') {
      result = result.filter((m) => m.material_type.toLowerCase() === filters.material_type!.toLowerCase());
    }

    if (filters.subject) {
      result = result.filter((m) => m.subject.toLowerCase().includes(filters.subject!.toLowerCase()));
    }

    if (filters.subject_code) {
      result = result.filter((m) => m.subject_code.toLowerCase().includes(filters.subject_code!.toLowerCase()));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.subject_code.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.material_type.toLowerCase().includes(q) ||
          `${m.year}st year`.includes(q) ||
          `${m.year}nd year`.includes(q) ||
          `${m.year}rd year`.includes(q) ||
          `${m.year}th year`.includes(q)
      );
    }

    const total = result.length;

    // Sorting
    if (filters.sortBy === 'downloads') {
      result.sort((a, b) => b.download_count - a.download_count);
    } else if (filters.sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Pagination
    if (filters.page && filters.limit) {
      const start = (filters.page - 1) * filters.limit;
      result = result.slice(start, start + filters.limit);
    }

    return { materials: result, total };
  }

  getMaterialById(id: string): Material | null {
    return this.data.materials.find((m) => m.id === id) || null;
  }

  createMaterial(data: Omit<Material, 'id' | 'download_count' | 'created_at' | 'updated_at'>): Material {
    const now = new Date().toISOString();
    const newMaterial: Material = {
      ...data,
      id: `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      download_count: 0,
      created_at: now,
      updated_at: now,
    };
    this.data.materials.unshift(newMaterial);
    this.save();
    return newMaterial;
  }

  updateMaterial(id: string, data: Partial<Omit<Material, 'id' | 'download_count' | 'created_at'>>): Material | null {
    const index = this.data.materials.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const existing = this.data.materials[index];
    const updated: Material = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.data.materials[index] = updated;
    this.save();
    return updated;
  }

  deleteMaterial(id: string): boolean {
    const initialLen = this.data.materials.length;
    this.data.materials = this.data.materials.filter((m) => m.id !== id);
    if (this.data.materials.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Downloads ---
  recordDownload(userId: string, materialId: string): Download | null {
    const material = this.data.materials.find((m) => m.id === materialId);
    if (!material) return null;

    material.download_count += 1;

    const download: Download = {
      id: `dld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      material_id: materialId,
      downloaded_at: new Date().toISOString(),
    };

    this.data.downloads.unshift(download);
    this.touchUserActivity(userId);
    this.save();
    return download;
  }

  getUserRecentDownloads(userId: string, limit: number = 6): (Material & { downloaded_at: string })[] {
    const userDownloads = this.data.downloads.filter((d) => d.user_id === userId);
    const seen = new Set<string>();
    const results: (Material & { downloaded_at: string })[] = [];

    for (const dld of userDownloads) {
      if (!seen.has(dld.material_id)) {
        seen.add(dld.material_id);
        const mat = this.data.materials.find((m) => m.id === dld.material_id);
        if (mat) {
          results.push({ ...mat, downloaded_at: dld.downloaded_at });
        }
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  getDownloadAnalytics(): {
    mostDownloaded: Material[];
    recentDownloads: (Download & { material_title?: string; material_subject?: string; user_name?: string; user_email?: string })[];
    downloadsByYear: Record<number, number>;
    downloadsByType: Record<string, number>;
  } {
    // Most downloaded materials (sorted desc)
    const mostDownloaded = [...this.data.materials]
      .sort((a, b) => b.download_count - a.download_count)
      .slice(0, 10);

    // Recent downloads with material and user details
    const recentDownloads = this.data.downloads
      .slice(0, 20)
      .map((d) => {
        const mat = this.data.materials.find((m) => m.id === d.material_id);
        const user = this.data.users.find((u) => u.id === d.user_id);
        return {
          ...d,
          material_title: mat?.title || 'Unknown Material',
          material_subject: mat?.subject || mat?.subject_code || 'Unknown Subject',
          user_name: user?.name || 'Verified Student',
          user_email: user?.email || '',
        };
      });

    // Breakdown by Year
    const downloadsByYear: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.data.materials.forEach((m) => {
      if (downloadsByYear[m.year] !== undefined) {
        downloadsByYear[m.year] += m.download_count;
      }
    });

    // Breakdown by Material Type
    const downloadsByType: Record<string, number> = {
      Notes: 0,
      'Mid-Term': 0,
      'End-Term': 0,
      PYQs: 0,
      Other: 0,
    };
    this.data.materials.forEach((m) => {
      if (downloadsByType[m.material_type] !== undefined) {
        downloadsByType[m.material_type] += m.download_count;
      }
    });

    return {
      mostDownloaded,
      recentDownloads,
      downloadsByYear,
      downloadsByType,
    };
  }

  // --- Admin Stats ---
  getAdminStats(): AdminStats {
    const nowTime = Date.now();
    const oneDayAgo = nowTime - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = nowTime - 30 * 24 * 60 * 60 * 1000;

    const totalUsers = this.data.users.length;
    const communityConfirmedUsers = this.data.users.filter((u) => u.community_joined).length;

    // Dynamic calculations based on last_active_at
    const activeToday = this.data.users.filter((u) => new Date(u.last_active_at).getTime() >= oneDayAgo).length;
    const activeThisWeek = this.data.users.filter((u) => new Date(u.last_active_at).getTime() >= sevenDaysAgo).length;
    const activeUsers = this.data.users.filter((u) => new Date(u.last_active_at).getTime() >= thirtyDaysAgo).length;

    const totalMaterials = this.data.materials.length;
    const totalDownloads = this.data.materials.reduce((acc, m) => acc + m.download_count, 0);

    const yearBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.data.materials.forEach((m) => {
      if (yearBreakdown[m.year] !== undefined) {
        yearBreakdown[m.year] += 1;
      }
    });

    const typeBreakdown: Record<string, number> = {
      Notes: 0,
      'Mid-Term': 0,
      'End-Term': 0,
      PYQs: 0,
      Other: 0,
    };
    this.data.materials.forEach((m) => {
      if (typeBreakdown[m.material_type] !== undefined) {
        typeBreakdown[m.material_type] += 1;
      }
    });

    const studentYearBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.data.users.forEach((u) => {
      const y = Number(u.year);
      if ([1, 2, 3, 4].includes(y)) {
        studentYearBreakdown[y] = (studentYearBreakdown[y] || 0) + 1;
      }
    });

    const communityVerified = communityConfirmedUsers;
    const communityPending = Math.max(0, totalUsers - communityVerified);

    return {
      totalUsers,
      communityVerified,
      communityPending,
      activeToday,
      activeThisWeek,
      activeUsers,
      totalMaterials,
      totalDownloads,
      yearBreakdown,
      typeBreakdown,
      studentYearBreakdown,
    };
  }

  // --- App Settings (Global Document Access Control) ---
  getAppSettings(): { allow_user_downloads: boolean; updated_at?: string; updated_by?: string } {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed?.app_settings) {
          this.data.app_settings = parsed.app_settings;
          return { ...parsed.app_settings };
        }
      }
    } catch {}
    if (!this.data.app_settings) {
      this.data.app_settings = {
        allow_user_downloads: true,
        updated_at: new Date().toISOString(),
        updated_by: 'system',
      };
      this.save();
    }
    return { ...this.data.app_settings };
  }

  updateAppSettings(settings: Partial<{ allow_user_downloads: boolean; updated_by?: string }>): {
    allow_user_downloads: boolean;
    updated_at: string;
    updated_by?: string;
  } {
    const current = this.getAppSettings();
    const updated = {
      allow_user_downloads:
        settings.allow_user_downloads !== undefined ? settings.allow_user_downloads : current.allow_user_downloads,
      updated_at: new Date().toISOString(),
      updated_by: settings.updated_by || current.updated_by || 'admin',
    };
    this.data.app_settings = updated;
    this.save();
    return updated;
  }

  // --- What's New Announcements ---
  getWhatsNew(activeOnly: boolean = true): WhatsNewItem[] {
    const list = this.data.whats_new || [];
    const filtered = activeOnly ? list.filter((item) => item.is_active) : list;
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  createWhatsNew(data: Omit<WhatsNewItem, 'id' | 'created_at'>): WhatsNewItem {
    const newItem: WhatsNewItem = {
      id: `wn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: data.title,
      description: data.description,
      type: data.type,
      link_type: data.link_type || null,
      link_target: data.link_target || null,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
      created_by: data.created_by || null,
    };
    if (!this.data.whats_new) this.data.whats_new = [];
    this.data.whats_new.unshift(newItem);
    this.save();
    return newItem;
  }

  toggleWhatsNewActive(id: string): WhatsNewItem | null {
    if (!this.data.whats_new) return null;
    const item = this.data.whats_new.find((w) => w.id === id);
    if (!item) return null;
    item.is_active = !item.is_active;
    this.save();
    return item;
  }

  deleteWhatsNew(id: string): boolean {
    if (!this.data.whats_new) return false;
    const initialLength = this.data.whats_new.length;
    this.data.whats_new = this.data.whats_new.filter((w) => w.id !== id);
    if (this.data.whats_new.length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Student Feedback & Missing Material Requests ---
  createFeedbackRequest(data: Omit<StudentFeedbackRequest, 'id' | 'created_at' | 'status'>): StudentFeedbackRequest {
    if (!this.data.feedback_requests) this.data.feedback_requests = [];
    const newReq: StudentFeedbackRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: data.user_id,
      user_name: data.user_name,
      user_email: data.user_email,
      user_year: data.user_year,
      type: data.type,
      subject_code: data.subject_code || '',
      subject_name: data.subject_name || '',
      material_type: data.material_type || '',
      title: data.title,
      description: data.description,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.data.feedback_requests.unshift(newReq);
    this.save();
    return newReq;
  }

  getFeedbackRequests(status?: string, userId?: string): StudentFeedbackRequest[] {
    let list = this.data.feedback_requests || [];
    if (userId) {
      list = list.filter((r) => r.user_id === userId);
    }
    const filtered = status && status !== 'all' ? list.filter((r) => r.status === status) : list;
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  updateFeedbackRequestStatus(
    id: string, 
    status: FeedbackRequestStatus, 
    adminNote?: string
  ): StudentFeedbackRequest | null {
    if (!this.data.feedback_requests) return null;
    const item = this.data.feedback_requests.find((r) => r.id === id);
    if (!item) return null;
    item.status = status;
    if (status === 'resolved') {
      item.resolved_at = new Date().toISOString();
    }
    if (adminNote !== undefined) {
      item.admin_note = adminNote;
    }
    this.save();
    return item;
  }

  deleteFeedbackRequest(id: string): boolean {
    if (!this.data.feedback_requests) return false;
    const initialLength = this.data.feedback_requests.length;
    this.data.feedback_requests = this.data.feedback_requests.filter((r) => r.id !== id);
    if (this.data.feedback_requests.length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Material Open History (Continue Studying) ---
  recordMaterialOpen(userId: string, materialId: string): MaterialOpenHistoryItem | null {
    if (!this.data.material_open_history) this.data.material_open_history = [];
    const now = new Date().toISOString();
    const existingIndex = this.data.material_open_history.findIndex(
      (h) => h.user_id === userId && h.material_id === materialId
    );

    if (existingIndex >= 0) {
      this.data.material_open_history[existingIndex].opened_at = now;
      const updated = this.data.material_open_history[existingIndex];
      this.save();
      return updated;
    } else {
      const newHistory: MaterialOpenHistoryItem = {
        id: `moh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: userId,
        material_id: materialId,
        opened_at: now,
      };
      this.data.material_open_history.unshift(newHistory);
      this.save();
      return newHistory;
    }
  }

  getUserMaterialOpenHistoryRaw(userId: string, limit: number = 8): MaterialOpenHistoryItem[] {
    const history = this.data.material_open_history || [];
    return history
      .filter((h) => h.user_id === userId)
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .slice(0, limit);
  }

  getUserMaterialOpenHistory(userId: string, limit: number = 8): (MaterialOpenHistoryItem & { material: Material })[] {
    const history = this.data.material_open_history || [];
    const userHistory = history
      .filter((h) => h.user_id === userId)
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());

    const result: (MaterialOpenHistoryItem & { material: Material })[] = [];
    for (const h of userHistory) {
      const mat = this.data.materials.find((m) => m.id === h.material_id);
      if (mat) {
        result.push({
          ...h,
          material: mat,
        });
      }
      if (result.length >= limit) break;
    }
    return result;
  }

  // --- Saved Materials (Bookmarks) ---
  toggleSaveMaterial(userId: string, materialId: string): { saved: boolean } {
    if (!this.data.saved_materials) this.data.saved_materials = [];
    const existingIndex = this.data.saved_materials.findIndex(
      (s) => s.user_id === userId && s.material_id === materialId
    );

    if (existingIndex >= 0) {
      this.data.saved_materials.splice(existingIndex, 1);
      this.save();
      return { saved: false };
    } else {
      this.data.saved_materials.unshift({
        id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: userId,
        material_id: materialId,
        saved_at: new Date().toISOString(),
      });
      this.save();
      return { saved: true };
    }
  }

  getSavedMaterialsRaw(userId: string, limit: number = 12): SavedMaterialItem[] {
    const saved = this.data.saved_materials || [];
    return saved
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
      .slice(0, limit);
  }

  getUserSavedMaterials(userId: string, limit: number = 12): (SavedMaterialItem & { material: Material })[] {
    const saved = this.data.saved_materials || [];
    const userSaved = saved
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());

    const result: (SavedMaterialItem & { material: Material })[] = [];
    for (const s of userSaved) {
      const mat = this.data.materials.find((m) => m.id === s.material_id);
      if (mat) {
        result.push({
          ...s,
          material: mat,
        });
      }
      if (result.length >= limit) break;
    }
    return result;
  }

  isMaterialSaved(userId: string, materialId: string): boolean {
    const saved = this.data.saved_materials || [];
    return saved.some((s) => s.user_id === userId && s.material_id === materialId);
  }

  getUserSavedMaterialIds(userId: string): string[] {
    const saved = this.data.saved_materials || [];
    return saved.filter((s) => s.user_id === userId).map((s) => s.material_id);
  }
}

// Singleton local db instance
let localDbInstance: LocalDatabaseStore | null = null;
export function getLocalDatabase(): LocalDatabaseStore {
  if (!localDbInstance) {
    localDbInstance = new LocalDatabaseStore();
  }
  return localDbInstance;
}
