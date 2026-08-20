package com.shelterfinder.il;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Asks for RECORD_AUDIO at runtime so the web view's speech recognition can
 * reach the microphone.
 *
 * Declaring the permission in the manifest is not enough: RECORD_AUDIO is a
 * "dangerous" permission, so until the user grants it Chromium reports
 * "Requires MODIFY_AUDIO_SETTINGS and RECORD_AUDIO. No audio device will be
 * available for recording" and the Web Speech API fails with 'not-allowed'.
 * Nothing in a plain Capacitor app triggers that prompt on its own.
 */
@CapacitorPlugin(
    name = "MicPermission",
    permissions = {
        @Permission(alias = MicPermissionPlugin.MIC, strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class MicPermissionPlugin extends Plugin {

    static final String MIC = "mic";

    /** Resolves with { granted: boolean }, prompting the user if needed. */
    @PluginMethod
    public void ensure(PluginCall call) {
        if (getPermissionState(MIC) == PermissionState.GRANTED) {
            resolveGranted(call, true);
        } else {
            requestPermissionForAlias(MIC, call, "micCallback");
        }
    }

    @PermissionCallback
    private void micCallback(PluginCall call) {
        resolveGranted(call, getPermissionState(MIC) == PermissionState.GRANTED);
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
