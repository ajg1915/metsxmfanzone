import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.metsxmfanzone.app',
  appName: 'MetsXMFanZone',
  webDir: 'dist',
  server: {
    url: 'https://metsxmfanzone.com',
    cleartext: true
  }
};

export default config;
