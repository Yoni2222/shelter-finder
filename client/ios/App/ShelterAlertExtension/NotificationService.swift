import UserNotifications
import CoreLocation

class NotificationService: UNNotificationServiceExtension, CLLocationManagerDelegate {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    var locationManager: CLLocationManager?
    var locationCompletion: ((CLLocation?) -> Void)?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let content = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        let data = request.content.userInfo
        let zone = data["zone"] as? String ?? ""
        let timeToShelter = data["timeToShelter"] as? String ?? "90"

        // Try to get fresh GPS
        requestLocation { [weak self] location in
            guard let self = self else { return }

            let loc = location ?? self.getCachedLocation()
            let lang = self.getStoredLanguage()
            let isHebrew = lang == "he"

            if let loc = loc, let shelter = self.findNearestShelter(lat: loc.coordinate.latitude, lon: loc.coordinate.longitude) {
                let distM = Int(shelter.distanceMeters)
                let walkMin = max(1, Int(round(Double(distM) / 80.0)))

                content.title = isHebrew ? "\u{1F6A8} \u{05D0}\u{05D6}\u{05E2}\u{05E7}\u{05D4}! \u{05D2}\u{05E9}\u{05D5} \u{05DC}\u{05DE}\u{05E7}\u{05DC}\u{05D8}" : "\u{1F6A8} Alert! Head to shelter"
                content.body = isHebrew ?
                    "\(shelter.name) \u{2013} \(distM)\u{05DE}\u{05F3} (\(walkMin) \u{05D3}\u{05E7}\u{05F3} \u{05D4}\u{05DC}\u{05D9}\u{05DB}\u{05D4})" :
                    "\(shelter.name) \u{2013} \(distM)m (\(walkMin) min walk)"

                // Store shelter coords in userInfo for tap action
                content.userInfo["shelterLat"] = shelter.lat
                content.userInfo["shelterLon"] = shelter.lon
                content.userInfo["shelterName"] = shelter.name
            } else {
                content.title = isHebrew ? "\u{1F6A8} \u{05D0}\u{05D6}\u{05E2}\u{05E7}\u{05D4}!" : "\u{1F6A8} Rocket Alert!"
                content.body = isHebrew ? "\u{05E4}\u{05EA}\u{05D7} \u{05D0}\u{05EA} \u{05D4}\u{05D0}\u{05E4}\u{05DC}\u{05D9}\u{05E7}\u{05E6}\u{05D9}\u{05D4} \u{05DC}\u{05DE}\u{05E6}\u{05D9}\u{05D0}\u{05EA} \u{05D4}\u{05DE}\u{05E7}\u{05DC}\u{05D8} \u{05D4}\u{05E7}\u{05E8}\u{05D5}\u{05D1}" : "Open the app to find the nearest shelter"
            }

            content.sound = .default
            content.interruptionLevel = .timeSensitive
            contentHandler(content)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Called when the 30s limit is about to expire
        if let content = bestAttemptContent, let handler = contentHandler {
            handler(content)
        }
    }

    // MARK: - Location

    func requestLocation(completion: @escaping (CLLocation?) -> Void) {
        locationCompletion = completion
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.desiredAccuracy = kCLLocationAccuracyBest

        // 8 second timeout for GPS
        DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) { [weak self] in
            if self?.locationCompletion != nil {
                self?.locationCompletion?(nil)
                self?.locationCompletion = nil
            }
        }

        locationManager?.requestLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.last {
            cacheLocation(location)
            locationCompletion?(location)
            locationCompletion = nil
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        locationCompletion?(nil)
        locationCompletion = nil
    }

    // MARK: - Shelter Search

    struct Shelter {
        let name: String
        let lat: Double
        let lon: Double
        let distanceMeters: Double
    }

    func findNearestShelter(lat: Double, lon: Double) -> Shelter? {
        // Read from App Group shared container
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.shelterfinder.il"
        ) else { return nil }

        let bundleURL = containerURL.appendingPathComponent("all-shelters.json")

        // Fallback: try main bundle
        let url = FileManager.default.fileExists(atPath: bundleURL.path) ? bundleURL :
                  Bundle.main.url(forResource: "all-shelters", withExtension: "json")

        guard let finalURL = url,
              let data = try? Data(contentsOf: finalURL),
              let shelters = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return nil
        }

        var nearest: Shelter?
        var minDist = Double.infinity

        for s in shelters {
            guard let sLat = s["lat"] as? Double,
                  let sLon = s["lon"] as? Double,
                  let name = s["name"] as? String ?? s["address"] as? String else { continue }

            let dist = haversine(lat1: lat, lon1: lon, lat2: sLat, lon2: sLon) * 1000
            if dist < minDist {
                minDist = dist
                nearest = Shelter(name: name, lat: sLat, lon: sLon, distanceMeters: dist)
            }
        }

        return nearest
    }

    func haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        let R = 6371.0
        let toRad = { (x: Double) -> Double in x * .pi / 180 }
        let dLat = toRad(lat2 - lat1)
        let dLon = toRad(lon2 - lon1)
        let a = sin(dLat / 2) * sin(dLat / 2) + cos(toRad(lat1)) * cos(toRad(lat2)) * sin(dLon / 2) * sin(dLon / 2)
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    // MARK: - Cached Location

    func getCachedLocation() -> CLLocation? {
        let defaults = UserDefaults(suiteName: "group.com.shelterfinder.il")
        guard let lat = defaults?.double(forKey: "lastLat"), lat != 0,
              let lon = defaults?.double(forKey: "lastLon"), lon != 0 else { return nil }

        let timestamp = defaults?.double(forKey: "lastLocTimestamp") ?? 0
        let age = Date().timeIntervalSince1970 - timestamp
        if age > 30 * 60 { return nil } // Older than 30 minutes - too stale

        return CLLocation(latitude: lat, longitude: lon)
    }

    func cacheLocation(_ location: CLLocation) {
        let defaults = UserDefaults(suiteName: "group.com.shelterfinder.il")
        defaults?.set(location.coordinate.latitude, forKey: "lastLat")
        defaults?.set(location.coordinate.longitude, forKey: "lastLon")
        defaults?.set(Date().timeIntervalSince1970, forKey: "lastLocTimestamp")
    }

    func getStoredLanguage() -> String {
        let defaults = UserDefaults(suiteName: "group.com.shelterfinder.il")
        return defaults?.string(forKey: "language") ?? "he"
    }
}
