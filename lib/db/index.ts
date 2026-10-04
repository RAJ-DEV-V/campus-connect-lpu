import { getLocalDatabase } from './local-store';
import { SupabaseDatabaseStore, isSupabaseConfigured } from './supabase';
import { User, Material, Download, Admin, AdminStats, MaterialFilters, CommunityVerificationLink } from './types';

const useSupabase = process.env.DATA_PROVIDER === 'supabase' && isSupabaseConfigured;
const localDb = getLocalDatabase();
const supabaseDb = useSupabase ? new SupabaseDatabaseStore() : null;

export async function getUserById(id: string): Promise<User | null> {
  if (supabaseDb) return await supabaseDb.getUserById(id);
  return localDb.getUserById(id);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (supabaseDb) return await supabaseDb.getUserByEmail(email);
  return localDb.getUserByEmail(email);
}

export async function upsertUser(userData: {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  community_joined?: boolean;
}): Promise<User> {
  if (supabaseDb) return await supabaseDb.upsertUser(userData);
  return localDb.upsertUser(userData);
}

export async function touchUserActivity(userId: string): Promise<void> {
  if (supabaseDb) return await supabaseDb.touchUserActivity(userId);
  localDb.touchUserActivity(userId);
}

export async function updateCommunityJoined(
  userId: string, 
  joined: boolean, 
  linkId?: string | null
): Promise<User | null> {
  if (supabaseDb) return await supabaseDb.updateCommunityJoined(userId, joined, linkId);
  return localDb.updateCommunityJoined(userId, joined, linkId);
}

export async function getCommunityVerificationLinks(): Promise<CommunityVerificationLink[]> {
  if (supabaseDb) return await supabaseDb.getCommunityVerificationLinks();
  return localDb.getCommunityVerificationLinks();
}

export async function getCommunityVerificationLinkById(id: string): Promise<CommunityVerificationLink | null> {
  if (supabaseDb) return await supabaseDb.getCommunityVerificationLinkById(id);
  return localDb.getCommunityVerificationLinkById(id);
}

export async function findActiveLinkByCode(inviteCode: string): Promise<CommunityVerificationLink | null> {
  if (supabaseDb) return await supabaseDb.findActiveLinkByCode(inviteCode);
  return localDb.findActiveLinkByCode(inviteCode);
}

export async function getActiveCommunityInviteUrl(): Promise<string> {
  if (supabaseDb) return await supabaseDb.getActiveCommunityInviteUrl();
  return localDb.getActiveCommunityInviteUrl();
}

export async function createCommunityVerificationLink(data: {
  name: string;
  invite_url: string;
  invite_code: string;
  type: 'community' | 'freshers_group' | 'other';
  is_active?: boolean;
  created_by?: string;
}): Promise<CommunityVerificationLink> {
  if (supabaseDb) return await supabaseDb.createCommunityVerificationLink(data);
  return localDb.createCommunityVerificationLink(data);
}

export async function updateCommunityVerificationLink(
  id: string,
  updates: Partial<Pick<CommunityVerificationLink, 'name' | 'invite_url' | 'invite_code' | 'type' | 'is_active'>>
): Promise<CommunityVerificationLink | null> {
  if (supabaseDb) return await supabaseDb.updateCommunityVerificationLink(id, updates);
  return localDb.updateCommunityVerificationLink(id, updates);
}

export async function deleteCommunityVerificationLink(id: string): Promise<boolean> {
  if (supabaseDb) return await supabaseDb.deleteCommunityVerificationLink(id);
  return localDb.deleteCommunityVerificationLink(id);
}

export async function revokeUsersVerifiedViaLink(linkId: string): Promise<number> {
  if (supabaseDb) return await supabaseDb.revokeUsersVerifiedViaLink(linkId);
  return localDb.revokeUsersVerifiedViaLink(linkId);
}

export async function getAllUsers(): Promise<User[]> {
  if (supabaseDb) return await supabaseDb.getAllUsers();
  return localDb.getAllUsers();
}

export async function getUserRole(userIdOrEmail: string): Promise<'owner' | 'admin' | 'user'> {
  if (userIdOrEmail.toLowerCase().trim() === 'mishra.rajvansh11@gmail.com') return 'owner';
  if (supabaseDb) return await supabaseDb.getUserRole(userIdOrEmail);
  return localDb.getUserRole(userIdOrEmail);
}

export async function isAdmin(userIdOrEmail: string): Promise<boolean> {
  const clean = userIdOrEmail.toLowerCase().trim();
  if (
    clean === 'mishra.rajvansh11@gmail.com' ||
    clean === 'admin@lpu.in' ||
    clean === 'usr_admin_lpu_01' ||
    clean === 'usr_owner_rajvansh'
  ) {
    return true;
  }
  if (supabaseDb) return await supabaseDb.isAdmin(userIdOrEmail);
  return localDb.isAdmin(userIdOrEmail);
}

export async function isOwner(userIdOrEmail: string): Promise<boolean> {
  const clean = userIdOrEmail.toLowerCase().trim();
  if (clean === 'mishra.rajvansh11@gmail.com' || clean === 'usr_owner_rajvansh') {
    return true;
  }
  if (supabaseDb) return await supabaseDb.isOwner(userIdOrEmail);
  return localDb.isOwner(userIdOrEmail);
}

export async function getAdmins(): Promise<Admin[]> {
  if (supabaseDb) return await supabaseDb.getAdmins();
  return localDb.getAdmins();
}

export async function addAdmin(email: string, role: 'owner' | 'admin' = 'admin', userId?: string): Promise<Admin> {
  if (supabaseDb) return await supabaseDb.addAdmin(email, role, userId);
  return localDb.addAdmin(email, role, userId);
}

export async function removeAdmin(adminIdOrEmail: string): Promise<boolean> {
  if (supabaseDb) return await supabaseDb.removeAdmin(adminIdOrEmail);
  return localDb.removeAdmin(adminIdOrEmail);
}

export async function revokeUserCommunityAccess(userId: string): Promise<boolean> {
  if (supabaseDb) return await supabaseDb.revokeUserCommunityAccess(userId);
  return localDb.revokeUserCommunityAccess(userId);
}

export async function getMaterials(filters: MaterialFilters = {}): Promise<{ materials: Material[]; total: number }> {
  if (supabaseDb) return await supabaseDb.getMaterials(filters);
  return localDb.getMaterials(filters);
}

export async function getMaterialById(id: string): Promise<Material | null> {
  if (supabaseDb) return await supabaseDb.getMaterialById(id);
  return localDb.getMaterialById(id);
}

export async function createMaterial(
  data: Omit<Material, 'id' | 'download_count' | 'created_at' | 'updated_at'>
): Promise<Material> {
  if (supabaseDb) return await supabaseDb.createMaterial(data);
  return localDb.createMaterial(data);
}

export async function updateMaterial(
  id: string,
  data: Partial<Omit<Material, 'id' | 'download_count' | 'created_at'>>
): Promise<Material | null> {
  if (supabaseDb) return await supabaseDb.updateMaterial(id, data);
  return localDb.updateMaterial(id, data);
}

export async function deleteMaterial(id: string): Promise<boolean> {
  if (supabaseDb) return await supabaseDb.deleteMaterial(id);
  return localDb.deleteMaterial(id);
}

export async function recordDownload(userId: string, materialId: string): Promise<Download | null> {
  if (supabaseDb) return await supabaseDb.recordDownload(userId, materialId);
  return localDb.recordDownload(userId, materialId);
}

export async function getUserRecentDownloads(
  userId: string,
  limit: number = 6
): Promise<(Material & { downloaded_at: string })[]> {
  if (supabaseDb) return await supabaseDb.getUserRecentDownloads(userId, limit);
  return localDb.getUserRecentDownloads(userId, limit);
}

export async function getAdminStats(): Promise<AdminStats> {
  if (supabaseDb) return await supabaseDb.getAdminStats();
  return localDb.getAdminStats();
}

export async function getDownloadAnalytics() {
  if (supabaseDb) return await supabaseDb.getDownloadAnalytics();
  return localDb.getDownloadAnalytics();
}

export async function getAppSettings(): Promise<{ allow_user_downloads: boolean; updated_at?: string; updated_by?: string }> {
  if (supabaseDb) return await supabaseDb.getAppSettings();
  return localDb.getAppSettings();
}

export async function updateAppSettings(settings: Partial<{ allow_user_downloads: boolean; updated_by?: string }>): Promise<{
  allow_user_downloads: boolean;
  updated_at: string;
  updated_by?: string;
}> {
  if (supabaseDb) return await supabaseDb.updateAppSettings(settings);
  return localDb.updateAppSettings(settings);
}

export function isUsingSupabase(): boolean {
  return Boolean(useSupabase);
}

export * from './types';
