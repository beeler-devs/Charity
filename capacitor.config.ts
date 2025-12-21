import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.courtcaptain.app',
  appName: 'CourtCaptain',
  webDir: 'out',
  server: {
    // For production: use your Vercel URL
    url: 'https://tennisnav-llg7onhop-benton-tamelings-projects.vercel.app',
    cleartext: true

    // For local development: uncomment this and comment above
    // url: 'http://localhost:3000',
    // cleartext: true
  }
};

export default config;
