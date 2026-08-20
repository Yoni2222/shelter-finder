package com.shelterfinder.il;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FirebaseTopicsPlugin.class);
        registerPlugin(MicPermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
