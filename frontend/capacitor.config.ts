import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kusuma.system',
  appName: 'System Kusuma',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    cleartext: true,
  }
};

export default config;
