package com.shelterfinder.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "FirebaseTopics")
public class FirebaseTopicsPlugin extends Plugin {

    @PluginMethod
    public void subscribeToTopic(PluginCall call) {
        String topic = call.getString("topic");
        if (topic == null || topic.isEmpty()) {
            call.reject("Topic is required");
            return;
        }

        FirebaseMessaging.getInstance().subscribeToTopic(topic)
            .addOnSuccessListener(aVoid -> call.resolve())
            .addOnFailureListener(e -> call.reject("Subscribe failed: " + e.getMessage()));
    }

    @PluginMethod
    public void unsubscribeFromTopic(PluginCall call) {
        String topic = call.getString("topic");
        if (topic == null || topic.isEmpty()) {
            call.reject("Topic is required");
            return;
        }

        FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
            .addOnSuccessListener(aVoid -> call.resolve())
            .addOnFailureListener(e -> call.reject("Unsubscribe failed: " + e.getMessage()));
    }
}
