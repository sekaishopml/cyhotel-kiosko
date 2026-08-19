package com.hoteldelvalle.kiosco;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.InputType;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final long RETRY_DELAY_MS = 8000L;
    private static final long TAP_WINDOW_MS = 2000L;
    private static final int TAPS_REQUIRED = 5;
    private static final long REAPPLY_DELAY_MS = 200L;

    private WebView webView;
    private View errorOverlay;
    private TextView errorMsg;
    private Button btnRetry;
    private View btnAdmin;

    private Prefs prefs;
    private boolean init = true;
    private String currentUrl = "";
    private int tapCount = 0;
    private long lastTapTime = 0;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable retryRunnable = new Runnable() {
        @Override
        public void run() {
            retry();
        }
    };

    private final Runnable reapplyRunnable = new Runnable() {
        @Override
        public void run() {
            if (KioskManager.isImmersive()) {
                KioskManager.reEnter(MainActivity.this);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        KioskManager.enterKioskMode(this);
        prefs = new Prefs(this);
        if (!prefs.isConfigured()) {
            startActivity(new Intent(this, SettingsActivity.class));
            finish();
            return;
        }
        setContentView(R.layout.activity_main);
        initViews();
        initWebView();
        loadUrl(prefs.getUrl());
    }

    private void initViews() {
        webView = findViewById(R.id.webview);
        errorOverlay = findViewById(R.id.errorOverlay);
        errorMsg = findViewById(R.id.errorMsg);
        btnRetry = findViewById(R.id.btnRetry);
        btnAdmin = findViewById(R.id.btnAdmin);
        btnRetry.setOnClickListener(v -> retry());
        btnAdmin.setOnClickListener(v -> showPinDialog());
    }

    private void initWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new KioskWebViewClient());
        webView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                onWebViewTouched();
            }
            return false;
        });
    }

    private void loadUrl(String url) {
        currentUrl = url;
        webView.loadUrl(url);
    }

    private void onWebViewTouched() {
        long now = SystemClock.uptimeMillis();
        if (now - lastTapTime > TAP_WINDOW_MS) {
            tapCount = 0;
        }
        lastTapTime = now;
        tapCount++;
        if (tapCount >= TAPS_REQUIRED) {
            tapCount = 0;
            showPinDialog();
        }
    }

    private void showPinDialog() {
        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        input.setHint(R.string.pin_dialog_hint);
        new AlertDialog.Builder(this)
                .setTitle(R.string.kiosk_pin_title)
                .setView(input)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(android.R.string.ok, (d, w) -> checkPin(input.getText().toString().trim()))
                .show();
    }

    private void checkPin(String entered) {
        if (entered.isEmpty() || !entered.equals(prefs.getPin())) {
            Toast.makeText(this, R.string.bad_pin, Toast.LENGTH_SHORT).show();
            return;
        }
        showAdminMenu();
    }

    private void showAdminMenu() {
        String[] options = {getString(R.string.opt_configure), getString(R.string.opt_exit)};
        new AlertDialog.Builder(this)
                .setTitle(R.string.kiosk_menu_title)
                .setItems(options, (d, which) -> {
                    if (which == 0) {
                        startActivity(new Intent(this, SettingsActivity.class));
                    } else if (which == 1) {
                        KioskManager.exitKioskMode(this);
                        finish();
                    }
                })
                .show();
    }

    private void showError(String message) {
        errorMsg.setText(message);
        errorOverlay.setVisibility(View.VISIBLE);
        handler.removeCallbacks(retryRunnable);
        handler.postDelayed(retryRunnable, RETRY_DELAY_MS);
    }

    private void hideError() {
        errorOverlay.setVisibility(View.GONE);
        handler.removeCallbacks(retryRunnable);
    }

    private void retry() {
        if (!currentUrl.isEmpty()) {
            webView.loadUrl(currentUrl);
        }
        handler.removeCallbacks(retryRunnable);
        handler.postDelayed(retryRunnable, RETRY_DELAY_MS);
    }

    @Override
    public void onBackPressed() {
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && KioskManager.isImmersive()) {
            handler.removeCallbacks(reapplyRunnable);
            handler.postDelayed(reapplyRunnable, REAPPLY_DELAY_MS);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        KioskManager.enterKioskMode(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView == null) {
            return;
        }
        KioskManager.reEnter(this);
        String url = prefs.getUrl();
        if (!url.isEmpty() && !url.equals(currentUrl)) {
            loadUrl(url);
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private class KioskWebViewClient extends WebViewClient {

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) {
                showError(getString(R.string.error_network));
            }
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            showError(getString(R.string.error_network));
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame()) {
                showError(getString(R.string.error_network));
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            hideError();
            if (init) {
                init = false;
            }
        }
    }
}
