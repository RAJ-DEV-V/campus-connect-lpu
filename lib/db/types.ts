export type MaterialType = 'Notes' | 'Mid-Term' | 'End-Term' | 'PYQs' | 'Other';
export type UserRole = 'owner' | 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role?: UserRole;
  community_joined: boolean;
  community_verified_at?: string | null;
  community_verification_link_id?: string | null;
  year?: number | null; // 1, 2, 3, 4
  profile_completed?: boolean;
  created_at: string;
  last_login: string;
  last_active_at: string; // Real-time user activity tracking
}

export interface WhatsNewItem {
  id: string;
  title: string;
  description: string;
  type: 'announcement' | 'new_material' | 'update' | 'important';
  link_type?: 'library' | 'material' | 'page' | null;
  link_target?: string | null;
  link?: string | null;
  is_active: boolean;
  active?: boolean;
  created_at: string;
  created_by?: string | null;
}

export interface MaterialOpenHistoryItem {
  id: string;
  user_id: string;
  material_id: string;
  opened_at: string;
  material?: Material;
}

export interface SavedMaterialItem {
  id: string;
  user_id: string;
  material_id: string;
  saved_at: string;
  material?: Material;
}

export type CommunityVerificationLinkType = 'community' | 'freshers_group' | 'other';

export interface CommunityVerificationLink {
  id: string;
  name: string;
  invite_url: string;
  invite_code: string;
  type: CommunityVerificationLinkType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  verified_count?: number; // Count of users verified via this link
}

export interface Material {
  id: string;
  title: string;
  description: string;
  subject: string;
  subject_code: string;
  year: number; // 1, 2, 3, 4 (1st Year to 4th Year)
  material_type: MaterialType;
  file_url: string;
  file_size: string;
  download_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;

  // Migration-Ready Google Drive Metadata
  drive_file_id?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  drive_account?: string | null; // e.g. 'primary_gmail', 'shared_drive_2026', 'migrated_target'
  backup_file_url?: string | null; // Rollback snapshot of previous File ID / URL
  migration_metadata?: Record<string, any> | null; // Migration audit trail & match metrics
}

export interface Download {
  id: string;
  user_id: string;
  material_id: string;
  downloaded_at: string;
}

export interface Admin {
  id: string;
  user_id?: string;
  email: string;
  role: 'owner' | 'admin';
  created_at: string;
}

export interface MaterialFilters {
  year?: number; // 1, 2, 3, 4
  material_type?: MaterialType | 'All';
  subject?: string;
  subject_code?: string;
  search?: string;
  sortBy?: 'newest' | 'downloads' | 'title';
  page?: number;
  limit?: number;
}

export interface AdminStats {
  totalUsers: number;
  communityVerified: number;
  communityPending: number;
  activeToday: number; // Active in last 24 hours
  activeThisWeek: number; // Active in last 7 days
  activeUsers: number; // Active in last 30 days
  totalMaterials: number;
  totalDownloads?: number;
  yearBreakdown: Record<number, number>; // 1, 2, 3, 4 (Materials count)
  typeBreakdown: Record<string, number>;
  studentYearBreakdown?: Record<number, number>; // 1, 2, 3, 4 (Students registered count)
}

export interface AppSettings {
  allow_user_downloads: boolean;
  require_community_verification: boolean;
  updated_at?: string;
  updated_by?: string;
}

export type FeedbackRequestType = 'bug_report' | 'missing_subject' | 'general_feedback' | 'community_verification';
export type FeedbackRequestStatus = 'pending' | 'in_progress' | 'resolved' | 'unavailable';

export interface StudentFeedbackRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_year?: number;
  year?: number;
  type: FeedbackRequestType;
  subject_code?: string;
  subject_name?: string;
  material_type?: string;
  title: string;
  description: string;
  status: FeedbackRequestStatus;
  created_at: string;
  resolved_at?: string | null;
  admin_note?: string | null;
  whatsapp_number?: string | null;
}


