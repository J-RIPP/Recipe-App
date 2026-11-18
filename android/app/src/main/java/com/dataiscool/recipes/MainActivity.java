package com.dataiscool.recipes;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareInboxPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // BridgeActivity also calls this once for the launch intent, so shares that open the app land here too.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        ShareInboxPlugin.handleIntent(this, intent);
    }
}
