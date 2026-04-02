package com.shelterfinder.il;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.location.Location;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

public class ShelterAlertService extends FirebaseMessagingService {

    private static final String TAG = "ShelterAlertService";
    private static final String CHANNEL_ID = "shelter_alerts";
    private static final int NOTIFICATION_ID = 1001;
    private static final String PREFS_NAME = "shelter_finder_prefs";
    private static final long GPS_TIMEOUT_MS = 8000;
    private static final long CACHED_LOCATION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        Map<String, String> data = message.getData();
        String zone = data.get("zone");
        if (zone == null) return;

        String timeToShelter = data.containsKey("timeToShelter") ? data.get("timeToShelter") : "90";
        String alertTime = data.containsKey("alertTime") ? data.get("alertTime") : "";

        createNotificationChannel();
        getLocationAndNotify(zone, timeToShelter, alertTime);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token refreshed");
    }

    private void getLocationAndNotify(String zone, String timeToShelter, String alertTime) {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Location cached = getCachedLocation();
            showShelterNotification(zone, timeToShelter, cached);
            return;
        }

        FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(this);
        CancellationTokenSource cts = new CancellationTokenSource();
        AtomicBoolean handled = new AtomicBoolean(false);

        fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                .addOnSuccessListener(location -> {
                    if (handled.compareAndSet(false, true)) {
                        if (location != null) {
                            cacheLocation(location);
                            showShelterNotification(zone, timeToShelter, location);
                        } else {
                            showShelterNotification(zone, timeToShelter, getCachedLocation());
                        }
                    }
                })
                .addOnFailureListener(e -> {
                    Log.w(TAG, "GPS acquisition failed", e);
                    if (handled.compareAndSet(false, true)) {
                        showShelterNotification(zone, timeToShelter, getCachedLocation());
                    }
                });

        // 8 second timeout — fall back to cached location
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (handled.compareAndSet(false, true)) {
                cts.cancel();
                Log.w(TAG, "GPS timeout after " + GPS_TIMEOUT_MS + "ms, using cached location");
                showShelterNotification(zone, timeToShelter, getCachedLocation());
            }
        }, GPS_TIMEOUT_MS);
    }

    private void showShelterNotification(String zone, String timeToShelter, Location location) {
        boolean isHebrew = "he".equals(getStoredLanguage());

        if (location == null) {
            String title = isHebrew ? "\uD83D\uDEA8 אזעקה!" : "\uD83D\uDEA8 Rocket Alert!";
            String body = isHebrew
                    ? "פתח את האפליקציה למציאת המקלט הקרוב"
                    : "Open the app to find the nearest shelter";
            showNotification(title, body, null);
            return;
        }

        ShelterResult shelter = findNearestShelter(location.getLatitude(), location.getLongitude());

        if (shelter == null) {
            String title = isHebrew ? "\uD83D\uDEA8 אזעקה!" : "\uD83D\uDEA8 Rocket Alert!";
            String body = isHebrew
                    ? "פתח את האפליקציה למציאת המקלט הקרוב"
                    : "Open the app to find the nearest shelter";
            showNotification(title, body, null);
            return;
        }

        int distM = (int) shelter.distanceMeters;
        int walkMin = Math.max(1, Math.round(distM / 80.0f)); // ~80m per minute walking

        String title = isHebrew ? "\uD83D\uDEA8 אזעקה! גשו למקלט" : "\uD83D\uDEA8 Alert! Head to shelter";
        String body;
        if (isHebrew) {
            body = shelter.name + " - " + distM + "מ׳ (" + walkMin + " דק׳ הליכה)";
        } else {
            body = shelter.name + " - " + distM + "m (" + walkMin + " min walk)";
        }

        Uri mapsUri = Uri.parse("google.navigation:q=" + shelter.lat + "," + shelter.lon + "&mode=w");
        showNotification(title, body, mapsUri);
    }

    private void showNotification(String title, String body, Uri mapsUri) {
        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        PendingIntent contentIntent;
        if (mapsUri != null) {
            Intent mapsIntent = new Intent(Intent.ACTION_VIEW, mapsUri);
            mapsIntent.setPackage("com.google.android.apps.maps");
            mapsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            contentIntent = PendingIntent.getActivity(this, 0, mapsIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        } else {
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launchIntent == null) {
                launchIntent = new Intent();
            }
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            contentIntent = PendingIntent.getActivity(this, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
                .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
                .setFullScreenIntent(contentIntent, true);

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            notificationManager.notify(NOTIFICATION_ID, builder.build());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Shelter Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Rocket alert notifications with nearest shelter directions");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            channel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
            );
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private ShelterResult findNearestShelter(double userLat, double userLon) {
        try {
            AssetManager assets = getAssets();
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(assets.open("all-shelters.json"), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();

            JSONArray shelters = new JSONArray(sb.toString());
            ShelterResult nearest = null;
            double minDist = Double.MAX_VALUE;

            for (int i = 0; i < shelters.length(); i++) {
                JSONObject s = shelters.getJSONObject(i);
                double sLat = s.getDouble("lat");
                double sLon = s.getDouble("lon");
                double dist = haversine(userLat, userLon, sLat, sLon);

                if (dist < minDist) {
                    minDist = dist;
                    nearest = new ShelterResult();
                    nearest.name = s.optString("name", "");
                    nearest.address = s.optString("address", "");
                    nearest.lat = sLat;
                    nearest.lon = sLon;
                    nearest.distanceMeters = dist;
                }
            }

            return nearest;
        } catch (Exception e) {
            Log.e(TAG, "Failed to load shelter data", e);
            return null;
        }
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371000; // Earth radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private Location getCachedLocation() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        float lat = prefs.getFloat("cached_lat", 0f);
        float lon = prefs.getFloat("cached_lon", 0f);
        long timestamp = prefs.getLong("cached_location_time", 0);

        if (lat == 0f && lon == 0f) return null;
        if (System.currentTimeMillis() - timestamp > CACHED_LOCATION_MAX_AGE_MS) return null;

        Location loc = new Location("cached");
        loc.setLatitude(lat);
        loc.setLongitude(lon);
        loc.setTime(timestamp);
        return loc;
    }

    private void cacheLocation(Location location) {
        SharedPreferences.Editor editor = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        editor.putFloat("cached_lat", (float) location.getLatitude());
        editor.putFloat("cached_lon", (float) location.getLongitude());
        editor.putLong("cached_location_time", System.currentTimeMillis());
        editor.apply();
    }

    private String getStoredLanguage() {
        // Capacitor Preferences plugin stores in "CapWebViewSettings" with key prefix
        SharedPreferences capPrefs = getSharedPreferences("CapWebViewSettings", Context.MODE_PRIVATE);
        String lang = capPrefs.getString("language", null);
        if (lang != null) return lang;
        // Fallback: try Capacitor's older storage name
        SharedPreferences capStorage = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        lang = capStorage.getString("language", null);
        if (lang != null) return lang;
        // Default to Hebrew
        return "he";
    }

    private static class ShelterResult {
        String name;
        String address;
        double lat;
        double lon;
        double distanceMeters;
    }
}
