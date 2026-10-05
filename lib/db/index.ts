import { getLocalDatabase } from './local-store';
import { SupabaseDatabaseStore, isSupabaseConfigured } from './supabase';
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
  year?: number | null;
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

export async function updateUserProfile(userId: string, data: { name?: string; year?: number }): Promise<User | null> {
  if (supabaseDb) return await supabaseDb.updateUserProfile(userId, data);
  return localDb.updateUserProfile(userId, data);
}

export async function getWhatsNew(activeOnly: boolean = true): Promise<WhatsNewItem[]> {
  if (supabaseDb) return await supabaseDb.getWhatsNew(activeOnly);
  return localDb.getWhatsNew(activeOnly);
}

export async function createWhatsNew(item: Omit<WhatsNewItem, 'id' | 'created_at'>): Promise<WhatsNewItem> {
  if (supabaseDb) return await supabaseDb.createWhatsNew(item);
  return localDb.createWhatsNew(item);
}

export async function toggleWhatsNewActive(id: string): Promise<WhatsNewItem | null> {
  if (supabaseDb) return await supabaseDb.toggleWhatsNewActive(id);
  return localDb.toggleWhatsNewActive(id);
}

export async function deleteWhatsNew(id: string): Promise<boolean> {
  if (supabaseDb) return await supabaseDb.deleteWhatsNew(id);
  return localDb.deleteWhatsNew(id);
}

export async function createFeedbackRequest(
  data: Omit<StudentFeedbackRequest, 'id' | 'created_at' | 'status'>
): Promise<StudentFeedbackRequest> {
  if (supabaseDb) return await supabaseDb.createFeedbackRequest(data);
  return localDb.createFeedbackRequest(data);
}

export async function getFeedbackRequests(status?: string, userId?: string): Promise<StudentFeedbackRequest[]> {
  if (supabaseDb) return await supabaseDb.getFeedbackRequests(status, userId);
  return localDb.getFeedbackRequests(status, userId);
}

export async function updateFeedbackRequestStatus(
  id: string,
  status: FeedbackRequestStatus,
  adminNote?: string
): Promise<StudentFeedbackRequest | null> {
  if (supabaseDb) return await supabaseDb.updateFeedbackRequestStatus(id, status, adminNote);
  return localDb.updateFeedbackRequestStatus(id, status, adminNote);
}

export async function deleteFeedbackRequest(id: string): Promise<boolean> {
  if (supabaseDb) return await supabaseDb.deleteFeedbackRequest(id);
  return localDb.deleteFeedbackRequest(id);
}

export async function recordMaterialOpen(userId: string, materialId: string): Promise<MaterialOpenHistoryItem | null> {
  if (supabaseDb) return await supabaseDb.recordMaterialOpen(userId, materialId);
  return localDb.recordMaterialOpen(userId, materialId);
}

export async function getUserMaterialOpenHistory(
  userId: string, 
  limit: number = 8
): Promise<(MaterialOpenHistoryItem & { material: Material })[]> {
  if (supabaseDb) return await supabaseDb.getUserMaterialOpenHistory(userId, limit);
  return localDb.getUserMaterialOpenHistory(userId, limit);
}

export async function toggleSaveMaterial(userId: string, materialId: string): Promise<{ saved: boolean }> {
  if (supabaseDb) return await supabaseDb.toggleSaveMaterial(userId, materialId);
  return localDb.toggleSaveMaterial(userId, materialId);
}

export async function getUserSavedMaterials(
  userId: string, 
  limit: number = 12
): Promise<(SavedMaterialItem & { material: Material })[]> {
  if (supabaseDb) return await supabaseDb.getUserSavedMaterials(userId, limit);
  return localDb.getUserSavedMaterials(userId, limit);
}

export async function getUserSavedMaterialIds(userId: string): Promise<string[]> {
  if (supabaseDb) return await supabaseDb.getUserSavedMaterialIds(userId);
  return localDb.getUserSavedMaterialIds(userId);
}

export function isUsingSupabase(): boolean {
  return Boolean(useSupabase);
}

export * from './types';

