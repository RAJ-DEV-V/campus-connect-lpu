// lib/supabase/config.ts
// Resolves Supabase credentials supporting both Next.js and Vite conventions

export const getSupabaseConfig = () => {
  const url = 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    '';

  const anonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  const serviceRoleKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SECRET_KEY ||
    '';

  const isConfigured = Boolean(
    url && 
    anonKey && 
    url !== 'https://your-project.supabase.co' &&
    !url.includes('example.com')
  );

  return {
    url,
    anonKey,
    serviceRoleKey,
    isConfigured,
  };
};
