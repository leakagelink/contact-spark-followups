import type { CapacitorConfig } from '@capacitor/cli';

// The native app loads the published web app, so the backend
// (auth, database, AI extraction) keeps working unchanged.
const config: CapacitorConfig = {
  appId: 'com.contactflowai.app',
  appName: 'ContactFlow AI',
  webDir: 'dist/client',
  server: {
    url: 'https://contact-spark-followups.lovable.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
