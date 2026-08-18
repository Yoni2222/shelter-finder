import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.shelterfinder.il',
  appName: 'Shelter Finder',
  webDir: 'dist',
  ios: {
    // Shown behind the status bar once the web view is inset - matches the
    // header gradient's top colour so the strip does not read as white.
    backgroundColor: '#0d2137',
  },
  server: {
    androidScheme: 'https',
    ...(isDev ? { url: 'http://10.0.2.2:3002', cleartext: true } : {}),
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_shelter',
      iconColor: '#FF0000'
    }
  }
};

export default config;
