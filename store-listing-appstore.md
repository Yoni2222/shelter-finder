# App Store Listing - Shelter Finder

Everything needed for App Store Connect except screenshots.
Fill in at: App Store Connect -> Shelter-Finder -> Distribution.

---

## App Information (left sidebar -> App Information)

**Name (max 30 chars)**
```
Shelter Finder Israel
```

**Subtitle (max 30 chars)**
```
Nearest Shelter in Seconds
```

**Primary Category:** Navigation
**Secondary Category:** Utilities

Navigation fits better than Tools: the core action is locating a place and
routing to it. Reviewers weigh category fit, and "Travel" would be a poor
match for an emergency app.

**Content Rights:** No, it does not contain third-party content.
(OpenStreetMap data is openly licensed and attributed in the app.)

---

## Promotional Text (max 170 chars, editable without review)

```
Find the nearest public shelter in Israel in seconds. Get alerts with the closest shelter and walking distance the moment a siren sounds in your area.
```

---

## Description

```
Shelter Finder helps you locate the nearest public shelter in Israel within seconds. When a siren sounds, every second counts.

ROCKET ALERT NOTIFICATIONS
Receive a push notification when an alert is issued for your area. The notification shows the nearest shelter and the walking distance, and tapping it opens walking directions. You do not need to open the app first.

FIND SHELTERS INSTANTLY
- Tap once to find shelters near your current location
- Search by any address in Israel
- Voice search for hands-free use
- Walking distance and estimated time for every result

ONE-TAP NAVIGATION
Tap any shelter to open Google Maps with walking directions.

COVERAGE
- More than 6,600 shelter locations
- Hebrew and English, with automatic language detection

WORKS WITHOUT A CONNECTION
Shelter data is stored on your device after first use, so you can still find the nearest shelter by GPS when networks are congested.

FREE
No ads. No in-app purchases. No account. No tracking.

DATA SOURCES
Shelter locations are compiled from publicly available municipal open-data portals and from OpenStreetMap contributors.

IMPORTANT
This app is an independent project and is not affiliated with, endorsed by, or operated by the Israeli Home Front Command (Pikud HaOref) or any government body. Shelter information is based on public data, may be incomplete or out of date, and is provided without warranty. It does not replace official instructions. Always follow the directions of the Home Front Command and local authorities.
```

**Why the last two sections matter:** Google Play rejected an earlier version
for "misleading claims" over wording like "verified shelters" and "official
municipal records". Apple reviews safety and emergency apps at least as
closely, and rejects apps that imply an official affiliation they do not have.
The wording above states the sources plainly and disclaims affiliation.

---

## Keywords (max 100 chars, comma separated, no spaces after commas)

```
shelter,miklat,bomb,rocket,alert,siren,israel,emergency,safety,mamad,navigate,map
```

Do not repeat words already in the app name or subtitle - Apple indexes those
separately, so repeating them wastes characters.

---

## URLs

**Support URL** (required)
```
https://shelter-finder.com
```

**Marketing URL** (optional)
```
https://shelter-finder.com
```

**Privacy Policy URL** (required)
```
https://shelter-finder.com/privacy-policy.html
```

---

## Age Rating (App Information -> Age Rating -> Edit)

Answer **None** to every content question. The app has no violence, no
profanity, no user-generated content, no gambling, no unrestricted web access.

Expected result: **4+**

One question to read carefully - if asked about "Medical/Treatment
Information", answer **No**. Locating a shelter is not medical advice.

---

## App Privacy (left sidebar -> App Privacy)

This section is a legal declaration, so the answers below are based on what the
code actually does. Verify anything you change later.

**Does this app collect data? YES** - the app sends coordinates to your server
to run the shelter search, so answering "No" would be inaccurate.

### Data type 1: Location -> Precise Location

- **Used for:** App Functionality
- **Linked to the user's identity:** No
- **Used for tracking:** No

Justification: coordinates are sent to `/api/shelters` to find nearby shelters
and are not stored against any account or identifier.

### Data type 2: Identifiers -> Device ID

- **Used for:** App Functionality
- **Linked to the user's identity:** No
- **Used for tracking:** No

Justification: the Firebase push token is registered with the server so alert
notifications can be delivered.

Do **not** declare anything under Contact Info, Health, Financial, Browsing
History, or Usage Data - the app collects none of those. There is no analytics
SDK in the build (only FirebaseCore and FirebaseMessaging).

---

## App Review Information (Distribution tab, near the bottom)

**Sign-in required:** No

**Notes for the reviewer:**
```
Shelter Finder locates public shelters in Israel.

The app is location-based and its data covers Israel only. If you test from outside Israel, the GPS button will correctly return no nearby results. To see the app working, please use the address search with an Israeli address, for example:

  Dizengoff 100, Tel Aviv
  Herzl 50, Haifa
  Jaffa Street, Jerusalem

Push notifications are triggered by real Home Front Command alerts, so they cannot be demonstrated on request. The notification permission prompt appears on first launch.

The app requires no account and collects no personal information.
```

Reviewers testing from California will otherwise see an empty map and may
reject the app as non-functional. This note has prevented that outcome for
similar location-restricted apps.

---

## Version Information

**Version:** 1.0
**Copyright:** 2026 Yonatan Ben Avraham

**What's New in This Version:** leave blank for the first release; it only
applies to updates.
