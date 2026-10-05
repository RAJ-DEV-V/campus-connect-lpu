import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Campus Connect LPU',
    short_name: 'Campus Connect',
    description: 'Centralized study materials, notes, question papers, and academic repository for LPU students',
    start_url: '/dashboard',
    id: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ea580c',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
