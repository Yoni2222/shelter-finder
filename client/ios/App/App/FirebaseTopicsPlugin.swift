import Foundation
import Capacitor
import FirebaseMessaging

/**
 * Bridges FCM topic subscription to JavaScript.
 * Mirrors the Android FirebaseTopicsPlugin so the shared TS code in
 * src/services/pushNotifications.ts works identically on both platforms.
 */
@objc(FirebaseTopicsPlugin)
public class FirebaseTopicsPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "FirebaseTopicsPlugin"
    public let jsName = "FirebaseTopics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "subscribeToTopic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unsubscribeFromTopic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]

    @objc func subscribeToTopic(_ call: CAPPluginCall) {
        guard let topic = call.getString("topic"), !topic.isEmpty else {
            call.reject("Topic is required")
            return
        }

        Messaging.messaging().subscribe(toTopic: topic) { error in
            if let error = error {
                call.reject("Subscribe failed: " + error.localizedDescription)
            } else {
                call.resolve()
            }
        }
    }

    @objc func unsubscribeFromTopic(_ call: CAPPluginCall) {
        guard let topic = call.getString("topic"), !topic.isEmpty else {
            call.reject("Topic is required")
            return
        }

        Messaging.messaging().unsubscribe(fromTopic: topic) { error in
            if let error = error {
                call.reject("Unsubscribe failed: " + error.localizedDescription)
            } else {
                call.resolve()
            }
        }
    }

    /// Returns the FCM registration token (not the raw APNs token).
    /// The server sends via FCM, so this is the value /api/register-token needs.
    @objc func getToken(_ call: CAPPluginCall) {
        Messaging.messaging().token { token, error in
            if let error = error {
                call.reject("Token fetch failed: " + error.localizedDescription)
            } else {
                call.resolve(["token": token ?? ""])
            }
        }
    }
}
