import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getLocalDatabase } from '@/lib/db/local-store';

export async function GET() {
  try {
    if (isSupabaseConfigured && supabase) {
      const [materialsRes, usersRes, downloadsRes] = await Promise.all([
        supabase.from('materials').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('downloads').select('*', { count: 'exact', head: true }),
      ]);

      const totalMaterials = materialsRes.count ?? 0;
      const totalUsers = usersRes.count ?? 0;
      const totalDownloads = downloadsRes.count ?? 0;

      return NextResponse.json(
        {
          success: true,
          stats: {
            totalMaterials,
            totalUsers,
            totalDownloads,
            academicYears: 4,
          },
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
    return NextResponse.json({
      success: true,
      stats: {
        totalMaterials: stats.totalMaterials,
        totalUsers: stats.totalUsers,
        totalDownloads: stats.totalDownloads,
        academicYears: 4,
      },
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
      },
      { status: 200 }
    );
  }
}
