import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zoneminder.zmNinjaNG',
  appName: 'zmNg',
  webDir: 'dist',
  server: {
    cleartext: true,
    // Use http scheme to avoid CORS issues when making requests to external servers
    androidScheme: 'http',
    iosScheme: 'http',
    // Allow navigation to any URL
    allowNavigation: ['*']
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#000000',
      showSpinner: false,
      fadeOutDuration: 200,
    },
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  }
};

export default config;
