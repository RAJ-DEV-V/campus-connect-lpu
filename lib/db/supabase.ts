import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
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
import { getLocalDatabase } from './local-store';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  supabaseUrl !== 'https://your-project.supabase.co'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })
  : null;

export class SupabaseDatabaseStore {
  private client = supabase!;
  private localFallback = getLocalDatabase();

  async getUserById(id: string): Promise<User | null> {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return this.localFallback.getUserById(id);
      }
      const local = this.localFallback.getUserById(id);
      return {
        ...(data as User),
        year: data.year ?? local?.year ?? null,
        profile_completed: Boolean(data.name && (data.year ?? local?.year)),
      };
    } catch {
      return this.localFallback.getUserById(id);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .ilike('email', email)
        .single();

      if (error || !data) {
        return this.localFallback.getUserByEmail(email);
      }
      const local = this.localFallback.getUserByEmail(email);
      return {
        ...(data as User),
        year: data.year ?? local?.year ?? null,
        profile_completed: Boolean(data.name && (data.year ?? local?.year)),
      };
    } catch {
      return this.localFallback.getUserByEmail(email);
    }
  }

  async upsertUser(userData: { id: string; name: string; email: string; avatar_url?: string; community_joined?: boolean; year?: number | null }): Promise<User> {
    const now = new Date().toISOString();
    let userId = userData.id;

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

    // If using service role client, sync with auth.users
    try {
      const { data: userList } = await this.client.auth.admin.listUsers();
      const existingAuth = userList?.users?.find(u => u.email?.toLowerCase() === userData.email.toLowerCase());
      
      if (existingAuth) {
        userId = existingAuth.id;
      } else if (!isValidUUID) {
        const { data: newAuth } = await this.client.auth.admin.createUser({
          email: userData.email,
          email_confirm: true,
          user_metadata: {
            full_name: userData.name,
            avatar_url: userData.avatar_url,
          },
        });
        if (newAuth?.user) {
          userId = newAuth.user.id;
        } else {
          userId = randomUUID();
        }
      }
    } catch (e) {
      if (!isValidUUID) {
        userId = randomUUID();
      }
    }

    // First check existing profile to strictly PRESERVE one-time community verification!
    let existingProfile: any = null;
    try {
      const { data: byId } = await this.client.from('users').select('*').eq('id', userId).single();
      if (byId) {
        existingProfile = byId;
      } else {
        const { data: byEmail } = await this.client.from('users').select('*').ilike('email', userData.email).single();
        if (byEmail) existingProfile = byEmail;
      }
    } catch {}

    const isAlreadyVerified = existingProfile ? Boolean(existingProfile.community_joined) : false;
    const finalCommunityJoined = userData.community_joined !== undefined 
      ? userData.community_joined 
      : isAlreadyVerified;

    // Strict persistence: Preserve existing student year so they never have to set it again
    const localUser = this.localFallback.getUserByEmail(userData.email);
    const existingYear = existingProfile?.year ?? localUser?.year ?? null;
    const finalYear = (userData.year !== undefined && userData.year !== null) 
      ? userData.year 
      : existingYear;

    const payload: any = {
      id: userId,
      name: userData.name,
      email: userData.email,
      avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.name)}`,
      community_joined: finalCommunityJoined,
      year: finalYear,
      profile_completed: Boolean(userData.name && finalYear),
      last_login: now,
      last_active_at: now,
    };

    try {
      const { data, error } = await this.client
        .from('users')
        .upsert(payload, { onConflict: 'email' })
        .select('*')
        .single();

      if (error) {
        console.warn('Supabase upsertUser falling back to local memory store:', error.message);
        return this.localFallback.upsertUser({ 
          ...userData, 
          id: userId,
          community_joined: finalCommunityJoined,
          year: finalYear,
        });
      }

      // Also sync to local fallback for dual availability
      this.localFallback.upsertUser(data as User);
      return data as User;
    } catch (err: any) {
      console.warn('Supabase upsertUser exception, falling back to local store:', err.message);
      return this.localFallback.upsertUser({ 
        ...userData, 
        id: userId,
        community_joined: finalCommunityJoined,
        year: finalYear,
      });
    }
  }

  async touchUserActivity(userId: string): Promise<void> {
    try {
      await this.client
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);
    } catch {}
    this.localFallback.touchUserActivity(userId);
  }

  async updateCommunityJoined(userId: string, joined: boolean, linkId?: string | null): Promise<User | null> {
    const now = new Date().toISOString();
    const updatePayload: any = {
      community_joined: joined,
      last_active_at: now,
    };

    try {
      const { data, error } = await this.client
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select('*')
        .single();

      if (!error && data) {
        this.localFallback.updateCommunityJoined(userId, joined, linkId);
        return data as User;
      }
    } catch {}
    return this.localFallback.updateCommunityJoined(userId, joined, linkId);
  }

  // --- Community Verification Links ---
  async getCommunityVerificationLinks(): Promise<CommunityVerificationLink[]> {
    try {
      const { data, error } = await this.client
        .from('community_verification_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        if (data.length === 0) return [];
        // Compute verified counts
        const linksWithCounts: CommunityVerificationLink[] = [];
        for (const link of data) {
          const { count } = await this.client
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('community_verification_link_id', link.id);
          linksWithCounts.push({
            ...link,
            verified_count: count || 0,
          });
        }
        return linksWithCounts;
      }
    } catch {}
    return this.localFallback.getCommunityVerificationLinks();
  }

  async getCommunityVerificationLinkById(id: string): Promise<CommunityVerificationLink | null> {
    try {
      const { data, error } = await this.client
        .from('community_verification_links')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const { count } = await this.client
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('community_verification_link_id', id);
        return { ...data, verified_count: count || 0 } as CommunityVerificationLink;
      }
    } catch {}
    return this.localFallback.getCommunityVerificationLinkById(id);
  }

  async findActiveLinkByCode(inviteCode: string): Promise<CommunityVerificationLink | null> {
    const clean = inviteCode.trim();
    try {
      const { data, error } = await this.client
        .from('community_verification_links')
        .select('*')
        .eq('is_active', true)
        .ilike('invite_code', clean)
        .limit(1);

      if (!error) {
        if (data && data.length > 0) {
          return data[0] as CommunityVerificationLink;
        }
        return null;
      }
    } catch {}
    return this.localFallback.findActiveLinkByCode(clean);
  }

  async getActiveCommunityInviteUrl(): Promise<string> {
    try {
      const { data, error } = await this.client
        .from('community_verification_links')
        .select('invite_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        return data[0].invite_url;
      }
    } catch {}
    return this.localFallback.getActiveCommunityInviteUrl();
  }

  async createCommunityVerificationLink(data: {
    name: string;
    invite_url: string;
    invite_code: string;
    type: 'community' | 'freshers_group' | 'other';
    is_active?: boolean;
    created_by?: string;
  }): Promise<CommunityVerificationLink> {
    const local = this.localFallback.createCommunityVerificationLink(data);
    try {
      const insertPayload: any = {
        name: data.name,
        invite_url: data.invite_url,
        invite_code: data.invite_code,
        type: data.type,
        is_active: data.is_active ?? true,
      };

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(local.id)) {
        insertPayload.id = local.id;
      }
      if (data.created_by) {
        insertPayload.created_by = data.created_by;
      }

      const { data: created, error } = await this.client
        .from('community_verification_links')
        .insert(insertPayload)
        .select('*')
        .single();

      if (!error && created) {
        return { ...created, verified_count: 0 } as CommunityVerificationLink;
      }
    } catch {}
    return local;
  }

  async updateCommunityVerificationLink(
    id: string,
    updates: Partial<Pick<CommunityVerificationLink, 'name' | 'invite_url' | 'invite_code' | 'type' | 'is_active'>>
  ): Promise<CommunityVerificationLink | null> {
    const local = this.localFallback.updateCommunityVerificationLink(id, updates);
    try {
      const { data, error } = await this.client
        .from('community_verification_links')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (!error && data) {
        return data as CommunityVerificationLink;
      }
    } catch {}
    return local;
  }

  async deleteCommunityVerificationLink(id: string): Promise<boolean> {
    const local = this.localFallback.deleteCommunityVerificationLink(id);
    try {
      const { error } = await this.client
        .from('community_verification_links')
        .delete()
        .eq('id', id);
      if (!error) return true;
    } catch {}
    return local;
  }

  async revokeUsersVerifiedViaLink(linkId: string): Promise<number> {
    const count = this.localFallback.revokeUsersVerifiedViaLink(linkId);
    try {
      await this.client
        .from('users')
        .update({
          community_joined: false,
          community_verified_at: null,
          community_verification_link_id: null,
        })
        .eq('community_verification_link_id', linkId);
    } catch {}
    return count;
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .order('last_active_at', { ascending: false });

      if (error || !data) {
        return this.localFallback.getAllUsers();
      }
      return data as User[];
    } catch {
      return this.localFallback.getAllUsers();
    }
  }

  async getUserRole(userIdOrEmail: string): Promise<'owner' | 'admin' | 'user'> {
    const term = userIdOrEmail.toLowerCase().trim();
    if (term === 'mishra.rajvansh11@gmail.com') return 'owner';
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrEmail.trim());

      let query = this.client
        .from('admins')
        .select('role');

      if (isUuid) {
        query = query.or(`user_id.eq.${userIdOrEmail.trim()},id.eq.${userIdOrEmail.trim()}`);
      } else {
        query = query.ilike('email', term);
      }

      const { data, error } = await query.limit(1);

      if (!error && data && data.length > 0) return data[0].role as any;
    } catch {}
    return this.localFallback.getUserRole(userIdOrEmail);
  }

  async isAdmin(userIdOrEmail: string): Promise<boolean> {
    const role = await this.getUserRole(userIdOrEmail);
    return role === 'owner' || role === 'admin';
  }

  async isOwner(userIdOrEmail: string): Promise<boolean> {
    const role = await this.getUserRole(userIdOrEmail);
    return role === 'owner';
  }

  async getAdmins(): Promise<Admin[]> {
    try {
      const { data, error } = await this.client
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) return data as Admin[];
    } catch {}
    return this.localFallback.getAdmins();
  }

  async addAdmin(email: string, role: 'owner' | 'admin' = 'admin', userId?: string): Promise<Admin> {
    const local = this.localFallback.addAdmin(email, role, userId);
    try {
      const { data, error } = await this.client
        .from('admins')
        .upsert({
          email: email.toLowerCase().trim(),
          role,
          user_id: userId || null,
        }, { onConflict: 'email' })
        .select('*')
        .single();

      if (!error && data) return data as Admin;
    } catch {}
    return local;
  }

  async removeAdmin(adminIdOrEmail: string): Promise<boolean> {
    const clean = adminIdOrEmail.toLowerCase().trim();
    if (
      clean === 'mishra.rajvansh11@gmail.com' ||
      clean === 'usr_owner_rajvansh' ||
      clean === 'adm_owner_rajvansh'
    ) {
      throw new Error('Owner account privileges cannot be removed.');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminIdOrEmail.trim());

    try {
      // Check target record in Supabase
      let checkQuery = this.client.from('admins').select('*');
      if (isUuid) {
        checkQuery = checkQuery.or(`id.eq.${adminIdOrEmail.trim()},user_id.eq.${adminIdOrEmail.trim()}`);
      } else {
        checkQuery = checkQuery.ilike('email', clean);
      }
      const { data: target } = await checkQuery.maybeSingle();

      if (target && (target.email?.toLowerCase() === 'mishra.rajvansh11@gmail.com' || target.role === 'owner')) {
        throw new Error('Owner account cannot be removed.');
      }
    } catch (e: any) {
      if (e.message?.includes('Owner account')) throw e;
    }

    const localSuccess = this.localFallback.removeAdmin(adminIdOrEmail);
    try {
      let delQuery = this.client.from('admins').delete();
      if (isUuid) {
        delQuery = delQuery.or(`id.eq.${adminIdOrEmail.trim()},user_id.eq.${adminIdOrEmail.trim()}`);
      } else {
        delQuery = delQuery.ilike('email', clean);
      }
      await delQuery;
    } catch {}
    return localSuccess;
  }

  async revokeUserCommunityAccess(userId: string): Promise<boolean> {
    const local = this.localFallback.revokeUserCommunityAccess(userId);
    try {
      await this.client
        .from('users')
        .update({
          community_joined: false,
          community_verified_at: null,
          community_verification_link_id: null,
        })
        .eq('id', userId);
    } catch {}
    return local;
  }

  async getMaterials(filters: MaterialFilters = {}): Promise<{ materials: Material[]; total: number }> {
    try {
      let query = this.client.from('materials').select('*', { count: 'exact' });

      if (filters.year && filters.year > 0) {
        query = query.eq('year', filters.year);
      }

      if (filters.material_type && filters.material_type !== 'All') {
        query = query.eq('material_type', filters.material_type);
      }

      if (filters.subject) {
        query = query.ilike('subject', `%${filters.subject}%`);
      }

      if (filters.subject_code) {
        query = query.ilike('subject_code', `%${filters.subject_code}%`);
      }

      if (filters.search) {
        const q = filters.search.trim();
        query = query.or(`title.ilike.%${q}%,subject.ilike.%${q}%,subject_code.ilike.%${q}%,description.ilike.%${q}%`);
      }

      if (filters.sortBy === 'downloads') {
        query = query.order('download_count', { ascending: false });
      } else if (filters.sortBy === 'title') {
        query = query.order('title', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (filters.page && filters.limit) {
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const { data, count, error } = await query;
      if (error || !data) {
        // Fallback to local store only on database error
        return this.localFallback.getMaterials(filters);
      }

      return { materials: (data as Material[]) || [], total: count !== null ? count : (data?.length || 0) };
    } catch {
      return this.localFallback.getMaterials(filters);
    }
  }

  async getMaterialById(id: string): Promise<Material | null> {
    try {
      const { data, error } = await this.client
        .from('materials')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return this.localFallback.getMaterialById(id);
      return data as Material;
    } catch {
      return this.localFallback.getMaterialById(id);
    }
  }

  async createMaterial(data: Omit<Material, 'id' | 'download_count' | 'created_at' | 'updated_at'>): Promise<Material> {
    try {
      const { data: created, error } = await this.client
        .from('materials')
        .insert({
          title: data.title,
          description: data.description,
          subject: data.subject,
          subject_code: data.subject_code,
          year: data.year,
          material_type: data.material_type,
          file_url: data.file_url,
          file_size: data.file_size,
          download_count: 0,
        })
        .select('*')
        .single();

      if (error) {
        return this.localFallback.createMaterial(data);
      }
      // Dual-sync: Keep local fallback memory/file store identically up to date
      const synced = created as Material;
      try {
        const existingLocal = this.localFallback.getMaterialById(synced.id);
        if (!existingLocal) {
          (this.localFallback as any).data.materials.unshift(synced);
          (this.localFallback as any).save();
        }
      } catch {}
      return synced;
    } catch {
      return this.localFallback.createMaterial(data);
    }
  }

  async updateMaterial(id: string, data: Partial<Omit<Material, 'id' | 'download_count' | 'created_at'>>): Promise<Material | null> {
    try {
      const { data: updated, error } = await this.client
        .from('materials')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) return this.localFallback.updateMaterial(id, data);
      this.localFallback.updateMaterial(id, data);
      return updated as Material;
    } catch {
      return this.localFallback.updateMaterial(id, data);
    }
  }

  async deleteMaterial(id: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('materials')
        .delete()
        .eq('id', id);

      this.localFallback.deleteMaterial(id);
      if (error) return false;
      return true;
    } catch {
      return this.localFallback.deleteMaterial(id);
    }
  }

  async recordDownload(userId: string, materialId: string): Promise<Download | null> {
    const localResult = this.localFallback.recordDownload(userId, materialId);
    try {
      const { data } = await this.client.from('downloads').insert({
        user_id: userId,
        material_id: materialId,
      }).select('*').single();
      if (data) return data as Download;
    } catch {}
    return localResult;
  }

  async getUserRecentDownloads(userId: string, limit: number = 6): Promise<(Material & { downloaded_at: string })[]> {
    try {
      const { data, error } = await this.client
        .from('downloads')
        .select('downloaded_at, materials (*)')
        .eq('user_id', userId)
        .order('downloaded_at', { ascending: false })
        .limit(limit);

      if (error || !data || data.length === 0) {
        return this.localFallback.getUserRecentDownloads(userId, limit);
      }

      return data.map((item: any) => ({
        ...item.materials,
        downloaded_at: item.downloaded_at,
      }));
    } catch {
      return this.localFallback.getUserRecentDownloads(userId, limit);
    }
  }

  async getDownloadAnalytics(): Promise<{
    mostDownloaded: Material[];
    recentDownloads: (Download & { material_title?: string; material_subject?: string; user_name?: string; user_email?: string })[];
    downloadsByYear: Record<number, number>;
    downloadsByType: Record<string, number>;
  }> {
    try {
      // Fetch top downloaded materials from Supabase
      const { data: topMats } = await this.client
        .from('materials')
        .select('*')
        .order('download_count', { ascending: false })
        .limit(10);

      // Fetch real downloads log with joined material and user records
      const { data: recentDlds } = await this.client
        .from('downloads')
        .select('*, materials (*), users (*)')
        .order('downloaded_at', { ascending: false })
        .limit(20);

      // Fetch all materials to compute real year and type download distributions
      const { data: allMats } = await this.client
        .from('materials')
        .select('year, material_type, download_count');

      const downloadsByYear: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const downloadsByType: Record<string, number> = {
        Notes: 0,
        'Mid-Term': 0,
        'End-Term': 0,
        PYQs: 0,
        Other: 0,
      };

      (allMats || []).forEach((m: any) => {
        if (downloadsByYear[m.year] !== undefined) {
          downloadsByYear[m.year] += (m.download_count || 0);
        }
        if (downloadsByType[m.material_type] !== undefined) {
          downloadsByType[m.material_type] += (m.download_count || 0);
        }
      });

      const formattedRecent = (recentDlds || []).map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        material_id: d.material_id,
        downloaded_at: d.downloaded_at,
        material_title: d.materials?.title || 'Study Material',
        material_subject: d.materials?.subject || 'Subject',
        user_name: d.users?.name || 'Student',
        user_email: d.users?.email || '',
      }));

      return {
        mostDownloaded: (topMats as Material[]) || [],
        recentDownloads: formattedRecent,
        downloadsByYear,
        downloadsByType,
      };
    } catch {
      return this.localFallback.getDownloadAnalytics();
    }
  }

  async getAdminStats(): Promise<AdminStats> {
    try {
      const { count: totalUsers } = await this.client.from('users').select('*', { count: 'exact', head: true });
      const { count: communityConfirmedUsers } = await this.client.from('users').select('*', { count: 'exact', head: true }).eq('community_joined', true);
      
      const nowTime = Date.now();
      const oneDayAgo = new Date(nowTime - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(nowTime - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(nowTime - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { count: activeToday } = await this.client.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', oneDayAgo);
      const { count: activeThisWeek } = await this.client.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', sevenDaysAgo);
      const { count: activeUsers } = await this.client.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', thirtyDaysAgo);

      // Calculate total materials and real breakdown from Supabase materials table
      const { data: allMats, count: totalMaterialsCount } = await this.client
        .from('materials')
        .select('year, material_type, download_count', { count: 'exact' });

      const totalMaterials = totalMaterialsCount || (allMats?.length || 0);

      // Real download count
      const { count: realDownloadLogCount } = await this.client
        .from('downloads')
        .select('*', { count: 'exact', head: true });

      const materialDownloadSum = (allMats || []).reduce((acc: number, m: any) => acc + (m.download_count || 0), 0);
      const totalDownloads = Math.max(realDownloadLogCount || 0, materialDownloadSum);

      const yearBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const typeBreakdown: Record<string, number> = {
        Notes: 0,
        'Mid-Term': 0,
        'End-Term': 0,
        PYQs: 0,
        Other: 0,
      };

      (allMats || []).forEach((m: any) => {
        if (yearBreakdown[m.year] !== undefined) {
          yearBreakdown[m.year] += 1;
        }
        if (typeBreakdown[m.material_type] !== undefined) {
          typeBreakdown[m.material_type] += 1;
        }
      });

      // Compute student count per academic year
      const { data: allUsersForYears } = await this.client
        .from('users')
        .select('year');

      const studentYearBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      (allUsersForYears || []).forEach((u: any) => {
        const y = Number(u.year);
        if ([1, 2, 3, 4].includes(y)) {
          studentYearBreakdown[y] = (studentYearBreakdown[y] || 0) + 1;
        }
      });

      const total = totalUsers || 0;
      const verified = communityConfirmedUsers || 0;
      const pending = Math.max(0, total - verified);

      return {
        totalUsers: total,
        communityVerified: verified,
        communityPending: pending,
        activeToday: activeToday || 0,
        activeThisWeek: activeThisWeek || 0,
        activeUsers: activeUsers || 0,
        totalMaterials,
        totalDownloads,
        yearBreakdown,
        typeBreakdown,
        studentYearBreakdown,
      };
    } catch {
      return this.localFallback.getAdminStats();
    }
  }

  async getAppSettings(): Promise<{ allow_user_downloads: boolean; updated_at?: string; updated_by?: string }> {
    try {
      const { data, error } = await this.client
        .from('app_settings')
        .select('*')
        .eq('key', 'allow_user_downloads')
        .maybeSingle();

      if (!error && data) {
        return {
          allow_user_downloads: data.value === true || data.value === 'true',
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        };
      }
    } catch {}
    return this.localFallback.getAppSettings();
  }

  async updateAppSettings(settings: Partial<{ allow_user_downloads: boolean; updated_by?: string }>): Promise<{
    allow_user_downloads: boolean;
    updated_at: string;
    updated_by?: string;
  }> {
    const local = this.localFallback.updateAppSettings(settings);
    try {
      if (settings.allow_user_downloads !== undefined) {
        await this.client
          .from('app_settings')
          .upsert({
            key: 'allow_user_downloads',
            value: settings.allow_user_downloads,
            updated_at: new Date().toISOString(),
            updated_by: settings.updated_by || 'admin',
          }, { onConflict: 'key' });
      }
    } catch {}
    return local;
  }

  // --- Student Profile Update ---
  async updateUserProfile(userId: string, data: { name?: string; year?: number }): Promise<User | null> {
    const local = this.localFallback.updateUserProfile(userId, data);
    try {
      const updates: any = {};
      if (data.name && data.name.trim()) updates.name = data.name.trim();
      if (data.year !== undefined && [1, 2, 3, 4].includes(data.year)) {
        updates.year = data.year;
        updates.profile_completed = Boolean((data.name || local?.name) && data.year);
      }
      updates.last_active_at = new Date().toISOString();

      const { data: updatedUser, error } = await this.client
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();

      if (!error && updatedUser) {
        return updatedUser as User;
      }
    } catch (err) {
      console.warn('Supabase updateUserProfile fallback:', err);
    }
    return local;
  }

  // --- What's New Announcements ---
  async getWhatsNew(activeOnly: boolean = true): Promise<WhatsNewItem[]> {
    try {
      let query = this.client
        .from('whats_new')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as WhatsNewItem[];
      }
    } catch {}
    return this.localFallback.getWhatsNew(activeOnly);
  }

  async createWhatsNew(item: Omit<WhatsNewItem, 'id' | 'created_at'>): Promise<WhatsNewItem> {
    const local = this.localFallback.createWhatsNew(item);
    try {
      const { data, error } = await this.client
        .from('whats_new')
        .insert([{
          title: item.title,
          description: item.description,
          type: item.type,
          link_type: item.link_type || null,
          link_target: item.link_target || null,
          is_active: item.is_active ?? true,
          created_by: item.created_by || null,
        }])
        .select('*')
        .single();

      if (!error && data) {
        return data as WhatsNewItem;
      }
    } catch {}
    return local;
  }

  async toggleWhatsNewActive(id: string): Promise<WhatsNewItem | null> {
    const local = this.localFallback.toggleWhatsNewActive(id);
    try {
      if (local) {
        await this.client
          .from('whats_new')
          .update({ is_active: local.is_active })
          .eq('id', id);
      }
    } catch {}
    return local;
  }

  async deleteWhatsNew(id: string): Promise<boolean> {
    const local = this.localFallback.deleteWhatsNew(id);
    try {
      await this.client
        .from('whats_new')
        .delete()
        .eq('id', id);
    } catch {}
    return local;
  }

  // --- Student Feedback & Missing Material Requests ---
  async createFeedbackRequest(data: Omit<StudentFeedbackRequest, 'id' | 'created_at' | 'status'>): Promise<StudentFeedbackRequest> {
    const local = this.localFallback.createFeedbackRequest(data);
    try {
      const { data: created, error } = await this.client
        .from('feedback_requests')
        .insert([{
          user_id: data.user_id,
          user_name: data.user_name,
          user_email: data.user_email,
          user_year: data.user_year || null,
          type: data.type,
          subject_code: data.subject_code || null,
          subject_name: data.subject_name || null,
          material_type: data.material_type || null,
          title: data.title,
          description: data.description,
          status: 'pending',
        }])
        .select('*')
        .single();

      if (!error && created) {
        return created as StudentFeedbackRequest;
      }
    } catch {}
    return local;
  }

  async getFeedbackRequests(status?: string): Promise<StudentFeedbackRequest[]> {
    try {
      let query = this.client
        .from('feedback_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as StudentFeedbackRequest[];
      }
    } catch {}
    return this.localFallback.getFeedbackRequests(status);
  }

  async updateFeedbackRequestStatus(
    id: string, 
    status: FeedbackRequestStatus, 
    adminNote?: string
  ): Promise<StudentFeedbackRequest | null> {
    const local = this.localFallback.updateFeedbackRequestStatus(id, status, adminNote);
    try {
      const updates: any = { status };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      if (adminNote !== undefined) {
        updates.admin_note = adminNote;
      }
      await this.client
        .from('feedback_requests')
        .update(updates)
        .eq('id', id);
    } catch {}
    return local;
  }

  async deleteFeedbackRequest(id: string): Promise<boolean> {
    const local = this.localFallback.deleteFeedbackRequest(id);
    try {
      await this.client
        .from('feedback_requests')
        .delete()
        .eq('id', id);
    } catch {}
    return local;
  }

  // --- Material Open History (Continue Studying) ---
  async recordMaterialOpen(userId: string, materialId: string): Promise<MaterialOpenHistoryItem | null> {
    const local = this.localFallback.recordMaterialOpen(userId, materialId);
    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('material_open_history')
        .upsert(
          { user_id: userId, material_id: materialId, opened_at: now },
          { onConflict: 'user_id,material_id' }
        )
        .select('*')
        .single();

      if (!error && data) {
        return data as MaterialOpenHistoryItem;
      }
    } catch (err) {
      console.warn('Supabase recordMaterialOpen fallback:', err);
    }
    return local;
  }

  async getUserMaterialOpenHistory(
    userId: string, 
    limit: number = 8
  ): Promise<(MaterialOpenHistoryItem & { material: Material })[]> {
    try {
      const { data, error } = await this.client
        .from('material_open_history')
        .select('*, material:materials(*)')
        .eq('user_id', userId)
        .order('opened_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data.filter((item: any) => item.material) as (MaterialOpenHistoryItem & { material: Material })[];
      }
    } catch {}

    const rawHistory = this.localFallback.getUserMaterialOpenHistoryRaw(userId, limit);
    const enrichedHistory: (MaterialOpenHistoryItem & { material: Material })[] = [];
    for (const h of rawHistory) {
      const mat = await this.getMaterialById(h.material_id);
      if (mat) {
        enrichedHistory.push({ ...h, material: mat });
      }
    }
    return enrichedHistory;
  }

  // --- Saved Materials (Bookmarks) ---
  async toggleSaveMaterial(userId: string, materialId: string): Promise<{ saved: boolean }> {
    const local = this.localFallback.toggleSaveMaterial(userId, materialId);
    try {
      // Check if already saved
      const { data: existing } = await this.client
        .from('saved_materials')
        .select('id')
        .eq('user_id', userId)
        .eq('material_id', materialId)
        .maybeSingle();

      if (existing) {
        await this.client
          .from('saved_materials')
          .delete()
          .eq('user_id', userId)
          .eq('material_id', materialId);
        return { saved: false };
      } else {
        await this.client
          .from('saved_materials')
          .insert([{ user_id: userId, material_id: materialId }]);
        return { saved: true };
      }
    } catch {}
    return local;
  }

  async getUserSavedMaterials(
    userId: string, 
    limit: number = 12
  ): Promise<(SavedMaterialItem & { material: Material })[]> {
    try {
      const { data, error } = await this.client
        .from('saved_materials')
        .select('*, material:materials(*)')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data.filter((item: any) => item.material) as (SavedMaterialItem & { material: Material })[];
      }
    } catch {}

    const rawSaved = this.localFallback.getSavedMaterialsRaw(userId, limit);
    const enrichedSaved: (SavedMaterialItem & { material: Material })[] = [];
    for (const s of rawSaved) {
      const mat = await this.getMaterialById(s.material_id);
      if (mat) {
        enrichedSaved.push({ ...s, material: mat });
      }
    }
    return enrichedSaved;
  }

  async getUserSavedMaterialIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('saved_materials')
        .select('material_id')
        .eq('user_id', userId);

      if (!error && data) {
        return data.map((d: any) => d.material_id);
      }
    } catch {}
    return this.localFallback.getUserSavedMaterialIds(userId);
  }
}
