import UIKit

extension AppDelegate {
    func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        guard let lat = userInfo["shelterLat"] as? Double,
              let lon = userInfo["shelterLon"] as? Double else { return }

        let mapsURL = URL(string: "comgooglemaps://?daddr=\(lat),\(lon)&directionsmode=walking")!
        let fallbackURL = URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(lat),\(lon)&travelmode=walking")!

        if UIApplication.shared.canOpenURL(mapsURL) {
            UIApplication.shared.open(mapsURL)
        } else {
            UIApplication.shared.open(fallbackURL)
        }
    }
}
