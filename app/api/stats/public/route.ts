import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getLocalDatabase } from '@/lib/db/local-store';

export async function GET() {
  try {
    let communityInviteUrl = 'https://chat.whatsapp.com/ElGakQUGGa1IMam5FlAiqw';

    if (isSupabaseConfigured && supabase) {
      const [materialsRes, usersRes, downloadsRes, communityLinkRes] = await Promise.all([
        supabase.from('materials').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('downloads').select('*', { count: 'exact', head: true }),
        supabase
          .from('community_verification_links')
          .select('invite_url')
          .eq('is_active', true)
          .eq('type', 'community')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const totalMaterials = materialsRes.count ?? 0;
      const totalUsers = usersRes.count ?? 0;
      const totalDownloads = downloadsRes.count ?? 0;

      if (communityLinkRes.data && communityLinkRes.data.length > 0) {
        communityInviteUrl = communityLinkRes.data[0].invite_url;
      }

      return NextResponse.json(
        {
          success: true,
          stats: {
            totalMaterials,
            totalUsers,
            totalDownloads,
            academicYears: 4,
          },
          communityInviteUrl,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      );
    }

    const localDb = getLocalDatabase();
    const stats = localDb.getAdminStats();
    const localInviteUrl = localDb.getActiveCommunityInviteUrl();
    return NextResponse.json({
      success: true,
      stats: {
        totalMaterials: stats.totalMaterials,
        totalUsers: stats.totalUsers,
        totalDownloads: stats.totalDownloads,
        academicYears: 4,
      },
      communityInviteUrl: localInviteUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: true,
        stats: {
          totalMaterials: 0,
          totalUsers: 0,
          totalDownloads: 0,
          academicYears: 4,
        },
        communityInviteUrl: 'https://chat.whatsapp.com/ElGakQUGGa1IMam5FlAiqw',
      },
      { status: 200 }
    );
  }
}
