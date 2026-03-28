import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shelterfinder.app',
  appName: 'Shelter Finder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'http://10.0.2.2:3002',
    cleartext: true,
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
