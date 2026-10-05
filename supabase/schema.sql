-- ==========================================================
-- Campus Connect LPU – Supabase Database Schema & RLS Policies
-- Fully functional Supabase Authentication with Google OAuth
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMMUNITY VERIFICATION LINKS TABLE
-- Approved WhatsApp invite links with strictly extracted invite codes
CREATE TABLE IF NOT EXISTS public.community_verification_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_url TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'community' NOT NULL CHECK (type IN ('community', 'freshers_group', 'other')),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by TEXT
);

-- 2. USERS TABLE
-- Primary relationship directly to auth.users.id
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    community_joined BOOLEAN DEFAULT FALSE NOT NULL,
    community_verified_at TIMESTAMP WITH TIME ZONE,
    community_verification_link_id UUID REFERENCES public.community_verification_links(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('owner', 'admin', 'user'))
);

-- 3. MATERIALS TABLE (Organized Year-Wise: 1st, 2nd, 3rd, 4th Year)
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1 AND year <= 4), -- 1st, 2nd, 3rd, 4th Year
    material_type TEXT NOT NULL CHECK (material_type IN ('Notes', 'Mid-Term', 'End-Term', 'PYQs', 'Other')),
    file_url TEXT NOT NULL,
    file_size TEXT NOT NULL,
    download_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Migration-Ready Google Drive Metadata Columns (Non-destructive, safe to run anytime)
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS drive_account TEXT DEFAULT 'primary_gmail';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS backup_file_url TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS migration_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_materials_drive_file_id ON public.materials(drive_file_id);

-- 3. DOWNLOADS TABLE
CREATE TABLE IF NOT EXISTS public.downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'admin' NOT NULL CHECK (role IN ('owner', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. APP SETTINGS TABLE (Global Document Access Control)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_by TEXT DEFAULT 'system'
);

-- Seed default global download setting
INSERT INTO public.app_settings (key, value, updated_by)
VALUES ('allow_user_downloads', 'true'::jsonb, 'system')
ON CONFLICT (key) DO NOTHING;

-- 6. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON public.materials(subject);
CREATE INDEX IF NOT EXISTS idx_materials_subject_code ON public.materials(subject_code);
CREATE INDEX IF NOT EXISTS idx_materials_year ON public.materials(year);
CREATE INDEX IF NOT EXISTS idx_materials_material_type ON public.materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_year_search ON public.materials(year, material_type, subject_code);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_material_id ON public.downloads(material_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);

-- 6. AUTOMATIC AUTH USER SYNC TRIGGER
-- When a student signs in through Google OAuth, create profile if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        name,
        email,
        avatar_url,
        community_joined,
        created_at,
        last_login,
        last_active_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
        FALSE,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        last_login = NOW(),
        last_active_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 7. DOWNLOAD COUNT AUTO-INCREMENT TRIGGER
CREATE OR REPLACE FUNCTION public.increment_material_download_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.materials
    SET download_count = download_count + 1
    WHERE id = NEW.material_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_download_count ON public.downloads;
CREATE TRIGGER trg_increment_download_count
AFTER INSERT ON public.downloads
FOR EACH ROW
EXECUTE FUNCTION public.increment_material_download_count();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.community_verification_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- COMMUNITY VERIFICATION LINKS POLICIES
-- Anyone authenticated can view active links to join
CREATE POLICY "Authenticated users can view active verification links"
ON public.community_verification_links FOR SELECT
TO authenticated
USING (
    is_active = TRUE
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid())
);

-- Only admins can insert, update, or delete verification links
CREATE POLICY "Only admins can manage verification links"
ON public.community_verification_links FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid())
);

-- USERS POLICIES
-- Students can read their own profile; admins can read all
CREATE POLICY "Users can read own profile"
ON public.users FOR SELECT
TO authenticated
USING (
    auth.uid() = id 
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid())
);

-- Students can update their own profile / community status
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role / user insert
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- MATERIALS POLICIES
-- Community confirmed students or admins can read materials
CREATE POLICY "Community verified students can read materials"
ON public.materials FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.community_joined = TRUE
    )
    OR EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()
    )
);

-- Only admins can insert, update, or delete study materials
CREATE POLICY "Only admins can insert materials"
ON public.materials FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()
    )
);

CREATE POLICY "Only admins can update materials"
ON public.materials FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()
    )
);

CREATE POLICY "Only admins can delete materials"
ON public.materials FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()
    )
);

-- DOWNLOADS POLICIES
CREATE POLICY "Students can record their own downloads"
ON public.downloads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students and admins can view downloads"
ON public.downloads FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid())
);

-- ADMINS POLICIES
CREATE POLICY "Admins can view admins table"
ON public.admins FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()));

-- APP SETTINGS POLICIES
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read app settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can modify app settings"
ON public.app_settings FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()));

-- Seed Owner Admin
INSERT INTO public.admins (email, role)
VALUES 
    ('mishra.rajvansh11@gmail.com', 'owner')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- 9. SUPABASE STORAGE BUCKET CONFIGURATION
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-materials', 'study-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated students with community access can download
CREATE POLICY "Authenticated users can download study materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'study-materials');

-- Only admins can upload files
CREATE POLICY "Only admins can upload study materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'study-materials' AND
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.email = auth.jwt()->>'email' OR admins.user_id = auth.uid()
    )
);
