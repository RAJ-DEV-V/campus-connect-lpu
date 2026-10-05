import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterials, updateMaterial } from '@/lib/db';
import { supabase } from '@/lib/db/supabase';
import { extractDriveFileId, parseMaterialFileMetadata } from '@/lib/drive-service';
import {
  scanDriveFolderRecursively,
  matchDriveFilesWithMaterials,
  MigrationMatchResult,
  RollbackSnapshot,
} from '@/lib/drive-migration';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const { materials } = await getMaterials({ limit: 1000 });

    let googleDriveCount = 0;
    let bundleCount = 0;
    let externalCount = 0;
    let supabaseStorageCount = 0;
    let totalDriveFiles = 0;

    for (const m of materials) {
      const meta = parseMaterialFileMetadata(m.file_url, m.title, m.file_size);
      if (meta.isBundle) {
        bundleCount++;
        totalDriveFiles += meta.bundleItems?.length || 0;
      } else if (meta.isGoogleDrive) {
        googleDriveCount++;
        totalDriveFiles++;
      } else if (meta.isExternalLink) {
        externalCount++;
      } else {
        supabaseStorageCount++;
      }
    }

    // Check for last migration info & rollback snapshot in app_settings
    let lastMigration: any = null;
    let rollbackAvailable = false;

    if (supabase) {
      try {
        const { data: lastRun } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'drive_migration_last_run')
          .maybeSingle();

        if (lastRun && lastRun.value) lastMigration = lastRun.value;

        const { data: snapshot } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'drive_migration_rollback_snapshot')
          .maybeSingle();

        if (snapshot && snapshot.value?.items?.length > 0) {
          rollbackAvailable = true;
        }
      } catch (err) {
        console.warn('Could not read migration settings:', err);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalMaterials: materials.length,
        googleDriveCount,
        bundleCount,
        totalDriveFiles,
        externalCount,
        supabaseStorageCount,
      },
      lastMigration,
      rollbackAvailable,
    });
  } catch (error: any) {
    console.error('Drive migration GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, folderId, accessToken, matches: passedMatches } = body;

    // 1. ACTION: DRY-RUN (Preview and Diff without any DB mutations)
    if (action === 'dry-run') {
      if (!folderId || !accessToken) {
        return NextResponse.json(
          { error: 'Missing folderId or Google OAuth accessToken for Drive scan.' },
          { status: 400 }
        );
      }

      const { materials } = await getMaterials({ limit: 1000 });
      const discoveredFiles = await scanDriveFolderRecursively(accessToken, folderId.trim());
      const report = matchDriveFilesWithMaterials(discoveredFiles, materials);
      report.targetFolderId = folderId.trim();

      return NextResponse.json({
        success: true,
        report,
      });
    }

    // 2. ACTION: EXECUTE (Apply migration mappings safely with rollback snapshot)
    if (action === 'execute') {
      const matches: MigrationMatchResult[] = passedMatches || [];
      if (!Array.isArray(matches) || matches.length === 0) {
        return NextResponse.json({ error: 'No matches provided for execution.' }, { status: 400 });
      }

      const { materials } = await getMaterials({ limit: 1000 });
      const materialMap = new Map(materials.map((m) => [m.id, m]));

      // Build Rollback Snapshot
      const snapshot: RollbackSnapshot = {
        snapshotId: `snap_${Date.now()}`,
        created_at: new Date().toISOString(),
        targetFolderId: folderId || '',
        items: [],
      };

      // Group matches by materialId
      const matchesByMaterial = new Map<string, MigrationMatchResult[]>();
      for (const match of matches) {
        if (!matchesByMaterial.has(match.materialId)) {
          matchesByMaterial.set(match.materialId, []);
        }
        matchesByMaterial.get(match.materialId)!.push(match);
      }

      let updatedCount = 0;

      for (const [materialId, matMatches] of Array.from(matchesByMaterial.entries())) {
        const material = materialMap.get(materialId);
        if (!material) continue;

        // Record snapshot for rollback
        snapshot.items.push({
          materialId: material.id,
          originalFileUrl: material.file_url,
          originalFileSize: material.file_size,
        });

        // Case A: Bundle material
        if (material.file_url?.trim().startsWith('[')) {
          try {
            const bundle = JSON.parse(material.file_url);
            if (Array.isArray(bundle)) {
              for (const m of matMatches) {
                if (typeof m.partIndex === 'number' && bundle[m.partIndex]) {
                  bundle[m.partIndex].drive_file_id = m.newFileId;
                  bundle[m.partIndex].url = m.newFileUrl;
                  if (m.newFileName) bundle[m.partIndex].name = m.newFileName;
                }
              }

              await updateMaterial(material.id, {
                file_url: JSON.stringify(bundle),
              });
              updatedCount++;
            }
          } catch (e) {
            console.error(`Failed to update bundle material ${material.id}:`, e);
          }
        } else {
          // Case B: Single file material
          const match = matMatches[0];
          if (match && match.newFileUrl) {
            await updateMaterial(material.id, {
              file_url: match.newFileUrl,
            });
            updatedCount++;
          }
        }
      }

      // Save rollback snapshot and last run log in app_settings
      if (supabase) {
        try {
          await supabase.from('app_settings').upsert({
            key: 'drive_migration_rollback_snapshot',
            value: snapshot,
            updated_at: new Date().toISOString(),
            updated_by: session.email || session.userId,
          });

          await supabase.from('app_settings').upsert({
            key: 'drive_migration_last_run',
            value: {
              timestamp: new Date().toISOString(),
              targetFolderId: folderId,
              updatedCount,
              totalMatches: matches.length,
              snapshotId: snapshot.snapshotId,
              executed_by: session.email || session.userId,
            },
            updated_at: new Date().toISOString(),
            updated_by: session.email || session.userId,
          });
        } catch (e) {
          console.warn('Could not record migration audit log:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Migration completed: Updated ${updatedCount} study materials with new Drive File IDs.`,
        updatedCount,
        snapshotId: snapshot.snapshotId,
      });
    }

    // 3. ACTION: ROLLBACK (Revert last migration run)
    if (action === 'rollback') {
      if (!supabase) {
        return NextResponse.json({ error: 'Supabase client required for rollback.' }, { status: 500 });
      }

      const { data: snapshotData, error: snapErr } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'drive_migration_rollback_snapshot')
        .maybeSingle();

      if (snapErr || !snapshotData?.value?.items) {
        return NextResponse.json({ error: 'No valid rollback snapshot found.' }, { status: 404 });
      }

      const snapshot: RollbackSnapshot = snapshotData.value;
      let restoredCount = 0;

      for (const item of snapshot.items) {
        await updateMaterial(item.materialId, {
          file_url: item.originalFileUrl,
          file_size: item.originalFileSize,
        });
        restoredCount++;
      }

      // Clear the snapshot after successful rollback
      await supabase.from('app_settings').upsert({
        key: 'drive_migration_rollback_snapshot',
        value: { items: [], restored_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
        updated_by: session.email || session.userId,
      });

      return NextResponse.json({
        success: true,
        message: `Rollback successful: Restored ${restoredCount} materials to their original Drive URLs.`,
        restoredCount,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Drive migration POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
