import './globals.css';
import 'jbx/main.css';

import { GoogleAnalytics } from '@next/third-parties/google';

import GitHubCorner from '@/components/GitHubCorner.jsx';

const DESCRIPTION = 'Create recursive images with the droste effect.';
const CANONICAL = 'https://javier.xyz/droste-creator';
const THUMBNAIL = 'https://javier.xyz/droste-creator/thumbnail.jpg';

// Absolute urls throughout: the canonical has to stay javier.xyz/droste-creator
// with no trailing slash, so nothing is left to url resolution.
export const metadata = {
  metadataBase: new URL('https://javier.xyz'),
  title: 'Droste Creator | Create recursive images with droste effect',
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'Droste Creator',
    description: DESCRIPTION,
    url: CANONICAL,
    images: [THUMBNAIL],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Droste Creator',
    description: DESCRIPTION,
    images: [THUMBNAIL],
  },
  appleWebApp: { capable: true },
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GitHubCorner />
        <GoogleAnalytics gaId="G-M2FT27FXS2" />
      </body>
    </html>
  );
}
