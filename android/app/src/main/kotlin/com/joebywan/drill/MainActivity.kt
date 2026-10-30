package com.joebywan.drill

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.io.File

/**
 * One WebView showing the web app from the APK's assets, as Saffron Road does. ES modules will not
 * load from file://, so WebViewAssetLoader serves assets/ at https://appassets.androidplatform.net:
 * a real https origin (modules, a secure context, stable localStorage) that Google reserves and
 * that never resolves, with no socket and no INTERNET permission.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportZoom(false)
            settings.textZoom = 100
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                // Only our own origin loads here; a tel: link (the help line) goes to the dialer.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host == HOST) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                    return true
                }
            }
            addJavascriptInterface(Bridge(), "DrillBridge")
        }
        setContentView(web)
        // targetSdk 35+ is edge to edge: keep the page out from under the system bars.
        ViewCompat.setOnApplyWindowInsetsListener(web) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            (v.layoutParams as ViewGroup.MarginLayoutParams).setMargins(bars.left, bars.top, bars.right, bars.bottom)
            v.requestLayout()
            insets
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
        if (savedInstanceState == null) web.loadUrl("https://$HOST/index.html") else web.restoreState(savedInstanceState)
    }

    /**
     * What the page calls (src/widget.js feature-detects `DrillBridge`). Every choice is made in JS;
     * this side stores what it is handed and renders it. Called on a WebView thread.
     */
    inner class Bridge {
        /** The session summary, after every save: widget looks, the day last done, the note's lines. */
        @JavascriptInterface
        fun summary(json: String) {
            Log.i(TAG, "summary: $json")
            Daily.prefs(this@MainActivity).edit().putString(Daily.SUMMARY, json).apply()
            Daily.refresh(this@MainActivity)
        }

        /** One of Lumi's poses as a PNG, drawn by the page from the app's own SVG. */
        @JavascriptInterface
        fun art(pose: String, png: String) {
            if (pose !in Daily.POSES) return
            File(filesDir, "lumi-$pose.png").writeBytes(Base64.decode(png, Base64.DEFAULT))
            Daily.render(this@MainActivity)
        }

        @JavascriptInterface
        fun remindersOn(): Boolean = Daily.prefs(this@MainActivity).getBoolean(Daily.REMIND_ON, false)

        /** The ⋯ screen's toggle. Switching it on is when Android 13+ asks for permission, and only then. */
        @JavascriptInterface
        fun reminders(on: Boolean) {
            Daily.prefs(this@MainActivity).edit().putBoolean(Daily.REMIND_ON, on).apply()
            if (on && Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) runOnUiThread { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1) }
            Daily.refresh(this@MainActivity)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val TAG = "DrillBridge"
    }
}
