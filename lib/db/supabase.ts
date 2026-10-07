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
  private academicYearsCache: Record<string, number> = {};
  private academicYearsCacheTime: number = 0;
  private materialsCache: Material[] | null = null;
  private materialsCacheTime: number = 0;
  private settingsCache: { allow_user_downloads: boolean; updated_at?: string; updated_by?: string } | null = null;
  private settingsCacheTime: number = 0;
  private adminStatsCache: AdminStats | null = null;
  private adminStatsCacheTime: number = 0;
  private whatsNewCache: WhatsNewItem[] | null = null;
  private whatsNewCacheTime: number = 0;
  private rolesCache: Record<string, 'owner' | 'admin' | 'user'> = {};
  private rolesCacheTime: number = 0;
  private usersCache: User[] | null = null;
  private usersCacheTime: number = 0;

  async getAllAcademicYearsMap(): Promise<Record<string, number>> {
    const now = Date.now();
    if (Object.keys(this.academicYearsCache).length > 0 && (now - this.academicYearsCacheTime < 60000)) {
      return this.academicYearsCache;
    }
    try {
      const { data } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'user_academic_years')
        .maybeSingle();

      if (data && data.value && typeof data.value === 'object') {
        const val = data.value as Record<string, any>;
        for (const [uid, info] of Object.entries(val)) {
          if (info && typeof info === 'object') {
            const yr = Number((info as any).year);
            if ([1, 2, 3, 4].includes(yr)) {
              this.academicYearsCache[uid] = yr;
              if ((info as any).email) {
                this.academicYearsCache[String((info as any).email).toLowerCase()] = yr;
              }
            }
          } else if (typeof info === 'number' && [1, 2, 3, 4].includes(info)) {
            this.academicYearsCache[uid] = info;
          }
        }
        this.academicYearsCacheTime = now;
      }
    } catch {}
    return this.academicYearsCache;
  }

  async getUserAcademicYear(userIdOrEmail: string): Promise<number | null> {
    const term = userIdOrEmail.toLowerCase().trim();
    if (this.academicYearsCache[term]) return this.academicYearsCache[term];
    if (this.academicYearsCache[userIdOrEmail]) return this.academicYearsCache[userIdOrEmail];
    const map = await this.getAllAcademicYearsMap();
    return map[userIdOrEmail] || map[term] || null;
  }

  async setUserAcademicYear(userId: string, year: number, name?: string, email?: string): Promise<void> {
    this.academicYearsCache[userId] = year;
    if (email) {
      this.academicYearsCache[email.toLowerCase()] = year;
    }
    try {
      const { data } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'user_academic_years')
        .maybeSingle();

      const map = (data?.value && typeof data.value === 'object') ? (data.value as Record<string, any>) : {};
      map[userId] = {
        year,
        name: name || undefined,
        email: email || undefined,
        updated_at: new Date().toISOString()
      };
      if (email) {
        map[email.toLowerCase()] = {
          year,
          name: name || undefined,
          email: email.toLowerCase(),
          updated_at: new Date().toISOString()
        };
      }

      await this.client
        .from('app_settings')
        .upsert({
          key: 'user_academic_years',
          value: map,
          updated_at: new Date().toISOString(),
          updated_by: 'system'
        });
    } catch (e) {
      console.error('Failed to save academic year to app_settings:', e);
    }
  }

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
      const savedYear = (await this.getUserAcademicYear(id)) ?? (data.email ? await this.getUserAcademicYear(data.email) : null);
      const resolvedYear = (data as any).year ?? savedYear ?? local?.year ?? null;

      return {
        ...(data as User),
        year: resolvedYear,
        profile_completed: Boolean(data.name && resolvedYear),
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
      const savedYear = (await this.getUserAcademicYear(data.id)) ?? (await this.getUserAcademicYear(email));
      const resolvedYear = (data as any).year ?? savedYear ?? local?.year ?? null;

      return {
        ...(data as User),
        year: resolvedYear,
        profile_completed: Boolean(data.name && resolvedYear),
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
    const savedYear = (await this.getUserAcademicYear(userId)) ?? (userData.email ? await this.getUserAcademicYear(userData.email) : null);
    const existingYear = existingProfile?.year ?? savedYear ?? localUser?.year ?? null;
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

    if (finalYear) {
      this.setUserAcademicYear(userId, finalYear, userData.name, userData.email).catch(() => {});
    }

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
    // Only update columns that actually exist in Supabase 'users' table
    const updatePayload: any = {
      community_joined: joined,
      last_active_at: now,
    };

    try {
      // 1. Try updating by id
      const { data, error } = await this.client
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select('*')
        .single();

      if (!error && data) {
        this.localFallback.updateCommunityJoined(userId, joined, linkId);
        this.adminStatsCache = null;
        this.usersCache = null;
        return {
          ...data,
          community_verified_at: joined ? now : null,
          community_verification_link_id: linkId || null,
        } as User;
      }

      // 2. Try updating by email if userId didn't match UUID
      const emailRes = await this.client
        .from('users')
        .update(updatePayload)
        .ilike('email', userId)
        .select('*')
        .single();

      if (!emailRes.error && emailRes.data) {
        this.localFallback.updateCommunityJoined(emailRes.data.id, joined, linkId);
        this.adminStatsCache = null;
        this.usersCache = null;
        return {
          ...emailRes.data,
          community_verified_at: joined ? now : null,
          community_verification_link_id: linkId || null,
        } as User;
      }
    } catch (e) {
      console.error('Supabase updateCommunityJoined error:', e);
    }

    // 4. Update in local store
    const local = this.localFallback.updateCommunityJoined(userId, joined, linkId);
    if (local) {
      this.adminStatsCache = null;
      return local;
    }

    // 5. Ultimate fallback: if user wasn't in DB yet, upsert them so approval never fails
    try {
      const email = userId.includes('@') ? userId.toLowerCase() : `${userId}@student.lpu.in`;
      const created = await this.upsertUser({
        id: userId,
        name: 'Student',
        email,
        community_joined: joined,
      });
      this.adminStatsCache = null;
      return created;
    } catch (e) {
      console.error('Final fallback upsert in updateCommunityJoined error:', e);
    }

    return null;
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
      // 1. Try to find the active main Community link specifically first
      const { data: communityData, error: communityError } = await this.client
        .from('community_verification_links')
        .select('invite_url')
        .eq('is_active', true)
        .eq('type', 'community')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!communityError && communityData && communityData.length > 0) {
        return communityData[0].invite_url;
      }

      // 2. Fallback to any active link
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
    this.localFallback.revokeUsersVerifiedViaLink(linkId);
    try {
      const { data, error } = await this.client
        .from('users')
        .update({
          community_joined: false,
          community_verified_at: null,
          community_verification_link_id: null,
        })
        .eq('community_verification_link_id', linkId)
        .select('id');

      if (!error && data) {
        return data.length;
      }
    } catch {}
    return this.localFallback.revokeUsersVerifiedViaLink(linkId);
  }

  async getAllUsers(forceFresh: boolean = false): Promise<User[]> {
    const now = Date.now();
    if (!forceFresh && this.usersCache && (now - this.usersCacheTime < 30000)) {
      return this.usersCache;
    }

    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .order('last_active_at', { ascending: false });

      if (error || !data) {
        return this.localFallback.getAllUsers();
      }

      const yearsMap = await this.getAllAcademicYearsMap();

      const userList = (data as any[]).map((u) => {
        const local = this.localFallback.getUserById(u.id) || (u.email ? this.localFallback.getUserByEmail(u.email) : null);
        const term = u.email ? u.email.toLowerCase() : '';
        const savedYear = yearsMap[u.id] ?? (term ? yearsMap[term] : undefined);
        const resolvedYear = u.year ?? savedYear ?? local?.year ?? null;

        return {
          ...u,
          year: resolvedYear,
          profile_completed: Boolean(u.name && resolvedYear),
        } as User;
      });

      this.usersCache = userList;
      this.usersCacheTime = now;
      return userList;
    } catch {
      return this.localFallback.getAllUsers();
    }
  }

  async getUserRole(userIdOrEmail: string): Promise<'owner' | 'admin' | 'user'> {
    const term = userIdOrEmail.toLowerCase().trim();
    if (term === 'mishra.rajvansh11@gmail.com' || term === 'usr_owner_rajvansh') return 'owner';

    const now = Date.now();
    if (this.rolesCache[term] && (now - this.rolesCacheTime < 60000)) {
      return this.rolesCache[term];
    }

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

      if (!error && data && data.length > 0) {
        const role = data[0].role as any;
        this.rolesCache[term] = role;
        this.rolesCacheTime = now;
        return role;
      }
    } catch {}
    const fallbackRole = this.localFallback.getUserRole(userIdOrEmail);
    this.rolesCache[term] = fallbackRole;
    this.rolesCacheTime = now;
    return fallbackRole;
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
    this.localFallback.revokeUserCommunityAccess(userId);
    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('users')
        .update({
          community_joined: false,
          last_active_at: now,
        })
        .eq('id', userId)
        .select('id');

      if (!error && data && data.length > 0) {
        this.adminStatsCache = null;
        this.usersCache = null;
        return true;
      }

      // If id didn't match (e.g. email was supplied), attempt email match
      const emailRes = await this.client
        .from('users')
        .update({
          community_joined: false,
          last_active_at: now,
        })
        .eq('email', userId)
        .select('id');

      if (!emailRes.error && emailRes.data && emailRes.data.length > 0) {
        this.adminStatsCache = null;
        this.usersCache = null;
        return true;
      }
    } catch (e) {
      console.error('Supabase revokeUserCommunityAccess error:', e);
    }
    return this.localFallback.revokeUserCommunityAccess(userId);
  }

  async getMaterials(filters: MaterialFilters = {}): Promise<{ materials: Material[]; total: number }> {
    try {
      const now = Date.now();
      // Cache warming / refresh: keeps entire library in RAM, refreshed every 60 seconds or on mutation
      if (!this.materialsCache || (now - this.materialsCacheTime > 60000)) {
        const { data, error } = await this.client
          .from('materials')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3000);

        if (!error && data) {
          this.materialsCache = data as Material[];
          this.materialsCacheTime = now;
        }
      }

      if (this.materialsCache && this.materialsCache.length > 0) {
        let filtered = this.materialsCache;

        if (filters.year && filters.year > 0) {
          filtered = filtered.filter((m) => m.year === filters.year);
        }

        if (filters.material_type && filters.material_type !== 'All') {
          filtered = filtered.filter((m) => m.material_type === filters.material_type);
        }

        if (filters.subject) {
          const sub = filters.subject.toLowerCase();
          filtered = filtered.filter((m) => m.subject.toLowerCase().includes(sub));
        }

        if (filters.subject_code) {
          const code = filters.subject_code.toLowerCase();
          filtered = filtered.filter((m) => m.subject_code.toLowerCase().includes(code));
        }

        if (filters.search) {
          const q = filters.search.toLowerCase().trim();
          filtered = filtered.filter((m) => {
            return (
              m.title.toLowerCase().includes(q) ||
              m.subject.toLowerCase().includes(q) ||
              m.subject_code.toLowerCase().includes(q) ||
              (m.description && m.description.toLowerCase().includes(q))
            );
          });
        }

        if (filters.sortBy === 'downloads') {
          filtered = [...filtered].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
        } else if (filters.sortBy === 'title') {
          filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
        } else {
          filtered = [...filtered].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }

        const total = filtered.length;
        if (filters.page && filters.limit) {
          const from = (filters.page - 1) * filters.limit;
          const to = from + filters.limit;
          filtered = filtered.slice(from, to);
        }

        return { materials: filtered, total };
      }

      // Fallback direct query if cache empty
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
      this.materialsCache = null;
      this.materialsCacheTime = 0;
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
      this.materialsCache = null;
      this.materialsCacheTime = 0;
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
      this.materialsCache = null;
      this.materialsCacheTime = 0;
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
      // Fetch top downloaded, recent downloads log, and materials concurrently
      const [topMatsRes, recentDldsRes, allMatsRes] = await Promise.all([
        this.client
          .from('materials')
          .select('*')
          .order('download_count', { ascending: false })
          .limit(10),
        this.client
          .from('downloads')
          .select('*, materials (*), users (*)')
          .order('downloaded_at', { ascending: false })
          .limit(20),
        this.client
          .from('materials')
          .select('year, material_type, download_count'),
      ]);

      const topMats = topMatsRes.data;
      const recentDlds = recentDldsRes.data;
      const allMats = allMatsRes.data;

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
      const nowTime = Date.now();
      if (this.adminStatsCache && nowTime - this.adminStatsCacheTime < 30000) {
        return this.adminStatsCache;
      }

      const oneDayAgo = new Date(nowTime - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(nowTime - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(nowTime - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Execute all metric queries concurrently in parallel
      const [
        totalUsersRes,
        communityUsersRes,
        activeTodayRes,
        activeThisWeekRes,
        activeUsersRes,
        matsRes,
        downloadsRes,
        usersYearRes
      ] = await Promise.all([
        this.client.from('users').select('*', { count: 'exact', head: true }),
        this.client.from('users').select('*', { count: 'exact', head: true }).eq('community_joined', true),
        this.client.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', oneDayAgo),
        this.client.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', sevenDaysAgo),
        this.client.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', thirtyDaysAgo),
        this.client.from('materials').select('year, material_type, download_count', { count: 'exact' }),
        this.client.from('downloads').select('*', { count: 'exact', head: true }),
        this.client.from('users').select('id, email'),
      ]);

      const totalUsers = totalUsersRes.count;
      const communityConfirmedUsers = communityUsersRes.count;
      const activeToday = activeTodayRes.count;
      const activeThisWeek = activeThisWeekRes.count;
      const activeUsers = activeUsersRes.count;

      const allMats = matsRes.data;
      const totalMaterialsCount = matsRes.count;
      const totalMaterials = totalMaterialsCount || (allMats?.length || 0);

      const realDownloadLogCount = downloadsRes.count;
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

      const yearsMap = await this.getAllAcademicYearsMap();
      const allUsersForYears = (usersYearRes.data as any[]) || [];
      const studentYearBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      allUsersForYears.forEach((u: any) => {
        const local = this.localFallback.getUserById(u.id) || (u.email ? this.localFallback.getUserByEmail(u.email) : null);
        const term = u.email ? u.email.toLowerCase() : '';
        const savedYear = yearsMap[u.id] ?? (term ? yearsMap[term] : undefined);
        const y = Number(savedYear ?? local?.year ?? (u as any).year);
        if ([1, 2, 3, 4].includes(y)) {
          studentYearBreakdown[y] = (studentYearBreakdown[y] || 0) + 1;
        }
      });

      const total = totalUsers || 0;
      const verified = communityConfirmedUsers || 0;
      const pending = Math.max(0, total - verified);

      const result: AdminStats = {
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

      this.adminStatsCache = result;
      this.adminStatsCacheTime = nowTime;
      return result;
    } catch {
      return this.localFallback.getAdminStats();
    }
  }

  async getAppSettings(): Promise<{ allow_user_downloads: boolean; updated_at?: string; updated_by?: string }> {
    const nowTime = Date.now();
    if (this.settingsCache && nowTime - this.settingsCacheTime < 60000) {
      return this.settingsCache;
    }

    try {
      const { data, error } = await this.client
        .from('app_settings')
        .select('*')
        .eq('key', 'allow_user_downloads')
        .maybeSingle();

      if (!error && data) {
        const res = {
          allow_user_downloads: data.value === true || data.value === 'true',
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        };
        this.settingsCache = res;
        this.settingsCacheTime = nowTime;
        return res;
      }
    } catch {}
    const fallbackSettings = this.localFallback.getAppSettings();
    this.settingsCache = fallbackSettings;
    this.settingsCacheTime = nowTime;
    return fallbackSettings;
  }

  async updateAppSettings(settings: Partial<{ allow_user_downloads: boolean; updated_by?: string }>): Promise<{
    allow_user_downloads: boolean;
    updated_at: string;
    updated_by?: string;
  }> {
    this.settingsCache = null;
    this.settingsCacheTime = 0;
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
    try {
      // 1. Fetch current user from Supabase
      const { data: currentUser, error: fetchErr } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const newName = data.name && data.name.trim() ? data.name.trim() : (currentUser?.name || 'Student');
      const newYear = data.year && [1, 2, 3, 4].includes(data.year) ? data.year : (currentUser?.year || null);

      if (currentUser) {
        // Safe updates for columns in users table
        const safeUpdates: any = {
          last_active_at: new Date().toISOString(),
        };
        if (data.name && data.name.trim()) {
          safeUpdates.name = data.name.trim();
        }
        if (newYear) {
          safeUpdates.year = newYear;
        }

        let updated: any = null;
        try {
          const { data: updData, error: updErr } = await this.client
            .from('users')
            .update(safeUpdates)
            .eq('id', userId)
            .select('*')
            .single();

          if (!updErr && updData) {
            updated = updData;
          } else if (updErr) {
            // If year column doesn't exist, retry without year
            delete safeUpdates.year;
            const { data: retryData } = await this.client
              .from('users')
              .update(safeUpdates)
              .eq('id', userId)
              .select('*')
              .single();
            if (retryData) updated = retryData;
          }
        } catch (e) {
          console.warn('Update users error:', e);
        }

        // Persist academic year to app_settings cloud store
        if (newYear) {
          await this.setUserAcademicYear(userId, newYear, newName, currentUser.email);
        }

        // Sync localFallback and invalidate cache
        this.localFallback.updateUserProfile(userId, { name: newName, year: newYear || undefined });
        this.adminStatsCache = null;

        const baseUser = updated || currentUser;
        return {
          id: baseUser.id,
          name: newName,
          email: baseUser.email,
          avatar_url: baseUser.avatar_url,
          community_joined: baseUser.community_joined,
          year: newYear,
          profile_completed: Boolean(newName && newYear),
          created_at: baseUser.created_at,
          last_login: baseUser.last_login,
          last_active_at: new Date().toISOString(),
        };
      } else {
        if (newYear) {
          await this.setUserAcademicYear(userId, newYear, newName);
        }
      }
    } catch (err) {
      console.warn('Supabase updateUserProfile error:', err);
    }

    const local = this.localFallback.updateUserProfile(userId, data);
    this.adminStatsCache = null;
    return local;
  }

  // --- What's New Announcements ---
  async getWhatsNew(activeOnly: boolean = true): Promise<WhatsNewItem[]> {
    const now = Date.now();
    if (this.whatsNewCache && (now - this.whatsNewCacheTime < 60000)) {
      if (activeOnly) {
        return this.whatsNewCache.filter(i => i.is_active !== false && (i as any).active !== false);
      }
      return this.whatsNewCache;
    }

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
        if (!activeOnly) {
          this.whatsNewCache = data as WhatsNewItem[];
          this.whatsNewCacheTime = now;
        }
        return data as WhatsNewItem[];
      }
    } catch {}

    // Cloud fallback: Persistent Supabase app_settings table
    try {
      const { data, error } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'announcements_broadcast')
        .maybeSingle();

      if (!error && data && Array.isArray(data.value)) {
        let items: WhatsNewItem[] = data.value;
        this.whatsNewCache = items;
        this.whatsNewCacheTime = now;
        if (activeOnly) {
          items = items.filter(i => i.is_active !== false && (i as any).active !== false);
        }
        return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    } catch (err) {
      console.warn('Supabase app_settings getWhatsNew error:', err);
    }

    return this.localFallback.getWhatsNew(activeOnly);
  }

  async createWhatsNew(item: Omit<WhatsNewItem, 'id' | 'created_at'>): Promise<WhatsNewItem> {
    this.whatsNewCache = null;
    const local = this.localFallback.createWhatsNew(item);
    let cloudCreated: WhatsNewItem | null = null;

    // 1. Try dedicated table in Supabase
    try {
      const { data, error } = await this.client
        .from('whats_new')
        .insert([{
          id: local.id,
          title: item.title,
          description: item.description,
          type: item.type,
          link_type: item.link_type || null,
          link_target: item.link_target || item.link || null,
          link: item.link || item.link_target || null,
          is_active: item.is_active ?? true,
          created_by: item.created_by || null,
        }])
        .select('*')
        .single();

      if (!error && data) {
        cloudCreated = data as WhatsNewItem;
      }
    } catch {}

    // 2. Persist to live Supabase app_settings table
    try {
      const { data: existingData } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'announcements_broadcast')
        .maybeSingle();

      const existing: WhatsNewItem[] = Array.isArray(existingData?.value) ? existingData.value : [];
      const updatedList = [local, ...existing.filter(i => i.id !== local.id)];

      await this.client
        .from('app_settings')
        .upsert({
          key: 'announcements_broadcast',
          value: updatedList,
          updated_at: new Date().toISOString(),
          updated_by: item.created_by || 'admin'
        });
    } catch (e) {
      console.error('Failed to persist announcement in Supabase app_settings:', e);
    }

    return cloudCreated || local;
  }

  async toggleWhatsNewActive(id: string): Promise<WhatsNewItem | null> {
    this.whatsNewCache = null;
    const local = this.localFallback.toggleWhatsNewActive(id);
    let updatedItem: WhatsNewItem | null = local;

    // 1. Try dedicated table in Supabase
    try {
      if (local) {
        const { data, error } = await this.client
          .from('whats_new')
          .update({ is_active: local.is_active })
          .eq('id', id)
          .select('*')
          .single();
        if (!error && data) {
          updatedItem = data as WhatsNewItem;
        }
      }
    } catch {}

    // 2. Update in live Supabase app_settings table
    try {
      const { data: existingData } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'announcements_broadcast')
        .maybeSingle();

      if (existingData && Array.isArray(existingData.value)) {
        const list: WhatsNewItem[] = existingData.value;
        const target = list.find(i => i.id === id);
        if (target) {
          target.is_active = !target.is_active;
          target.active = target.is_active;
          await this.client
            .from('app_settings')
            .upsert({
              key: 'announcements_broadcast',
              value: list,
              updated_at: new Date().toISOString(),
              updated_by: 'admin'
            });
          updatedItem = target;
        }
      }
    } catch (e) {
      console.error('Failed to toggle announcement in Supabase app_settings:', e);
    }

    return updatedItem;
  }

  async deleteWhatsNew(id: string): Promise<boolean> {
    this.whatsNewCache = null;
    const local = this.localFallback.deleteWhatsNew(id);
    let deleted = local;

    // 1. Try dedicated table in Supabase
    try {
      await this.client
        .from('whats_new')
        .delete()
        .eq('id', id);
    } catch {}

    // 2. Remove from live Supabase app_settings table
    try {
      const { data: existingData } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'announcements_broadcast')
        .maybeSingle();

      if (existingData && Array.isArray(existingData.value)) {
        const list: WhatsNewItem[] = existingData.value;
        const filtered = list.filter(i => i.id !== id);
        await this.client
          .from('app_settings')
          .upsert({
            key: 'announcements_broadcast',
            value: filtered,
            updated_at: new Date().toISOString(),
            updated_by: 'admin'
          });
        deleted = true;
      }
    } catch (e) {
      console.error('Failed to delete announcement from Supabase app_settings:', e);
    }

    return deleted;
  }

  // --- Student Feedback & Missing Material Requests ---
  async createFeedbackRequest(data: Omit<StudentFeedbackRequest, 'id' | 'created_at' | 'status'>): Promise<StudentFeedbackRequest> {
    const local = this.localFallback.createFeedbackRequest(data);
    let cloudCreated: StudentFeedbackRequest | null = null;

    try {
      const { data: created, error } = await this.client
        .from('feedback_requests')
        .insert([{
          id: local.id,
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
          whatsapp_number: data.whatsapp_number || null,
          status: 'pending',
        }])
        .select('*')
        .single();

      if (!error && created) {
        cloudCreated = created as StudentFeedbackRequest;
      }
    } catch {}

    // Persist to live Supabase app_settings table
    try {
      const { data: existingData } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'student_feedback_requests')
        .maybeSingle();

      const existing: StudentFeedbackRequest[] = Array.isArray(existingData?.value) ? existingData.value : [];
      const updatedList = [local, ...existing.filter(i => i.id !== local.id)];

      await this.client
        .from('app_settings')
        .upsert({
          key: 'student_feedback_requests',
          value: updatedList,
          updated_at: new Date().toISOString(),
          updated_by: data.user_email || 'student'
        });
    } catch (e) {
      console.error('Failed to persist feedback in Supabase app_settings:', e);
    }

    return cloudCreated || local;
  }

  async getFeedbackRequests(status?: string, userId?: string): Promise<StudentFeedbackRequest[]> {
    try {
      let query = this.client
        .from('feedback_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as StudentFeedbackRequest[];
      }
    } catch {}

    // Fallback: live Supabase app_settings table
    try {
      const { data, error } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'student_feedback_requests')
        .maybeSingle();

      if (!error && data && Array.isArray(data.value)) {
        let items: StudentFeedbackRequest[] = data.value;
        if (userId) {
          items = items.filter(r => r.user_id === userId);
        }
        if (status && status !== 'all') {
          items = items.filter(r => r.status === status);
        }
        return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    } catch (err) {
      console.warn('Supabase app_settings getFeedbackRequests error:', err);
    }

    return this.localFallback.getFeedbackRequests(status, userId);
  }

  async updateFeedbackRequestStatus(
    id: string, 
    status: FeedbackRequestStatus, 
    adminNote?: string
  ): Promise<StudentFeedbackRequest | null> {
    const local = this.localFallback.updateFeedbackRequestStatus(id, status, adminNote);
    let updatedItem: StudentFeedbackRequest | null = local;

    try {
      const updates: any = { status };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      if (adminNote !== undefined) {
        updates.admin_note = adminNote;
      }
      const { data, error } = await this.client
        .from('feedback_requests')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (!error && data) {
        updatedItem = data as StudentFeedbackRequest;
      }
    } catch {}

    // Update in live Supabase app_settings table
    try {
      const { data: existingData } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'student_feedback_requests')
        .maybeSingle();

      if (existingData && Array.isArray(existingData.value)) {
        const list: StudentFeedbackRequest[] = existingData.value;
        const target = list.find(r => r.id === id);
        if (target) {
          target.status = status;
          if (status === 'resolved') {
            target.resolved_at = new Date().toISOString();
          }
          if (adminNote !== undefined) {
            target.admin_note = adminNote;
          }
          await this.client
            .from('app_settings')
            .upsert({
              key: 'student_feedback_requests',
              value: list,
              updated_at: new Date().toISOString(),
              updated_by: 'admin'
            });
          updatedItem = target;
        }
      }
    } catch (e) {
      console.error('Failed to update feedback in Supabase app_settings:', e);
    }

    return updatedItem;
  }

  async deleteFeedbackRequest(id: string): Promise<boolean> {
    const local = this.localFallback.deleteFeedbackRequest(id);
    let deleted = local;

    try {
      await this.client
        .from('feedback_requests')
        .delete()
        .eq('id', id);
    } catch {}

    // Delete in live Supabase app_settings table
    try {
      const { data: existingData } = await this.client
        .from('app_settings')
        .select('value')
        .eq('key', 'student_feedback_requests')
        .maybeSingle();

      if (existingData && Array.isArray(existingData.value)) {
        const list: StudentFeedbackRequest[] = existingData.value;
        const filtered = list.filter(r => r.id !== id);
        await this.client
          .from('app_settings')
          .upsert({
            key: 'student_feedback_requests',
            value: filtered,
            updated_at: new Date().toISOString(),
            updated_by: 'admin'
          });
        deleted = true;
      }
    } catch (e) {
      console.error('Failed to delete feedback from Supabase app_settings:', e);
    }

    return deleted;
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
