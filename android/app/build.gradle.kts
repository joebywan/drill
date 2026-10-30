plugins {
    id("com.android.application")
}

// ---- the web app ------------------------------------------------------------------------------
//
// Not vendored here. The repo root holds the one copy of index.html, styles.css, src/ and assets/,
// and the three packages the import map points at (run `npm ci` first): the same set pages.yml
// publishes, so keep the two in step. This Sync puts them in a
// generated assets dir, so every APK is built from whatever the root says now, and a file deleted
// there is gone from the next APK too.
val webRoot = rootProject.projectDir.parentFile
val webAssets = layout.buildDirectory.dir("generated/web")
val copyWebAssets = tasks.register<Sync>("copyWebAssets") {
    from(webRoot) {
        include("index.html", "styles.css", "src/**", "assets/**")
        include("node_modules/chess.js/dist/esm/**", "node_modules/ts-fsrs/dist/index.mjs", "node_modules/cm-chessboard/src/**", "node_modules/cm-chessboard/assets/**")
        exclude("**/*.map", "**/*.d.ts")
    }
    into(webAssets)
    doLast {
        if (!webAssets.get().file("node_modules/chess.js/dist/esm/chess.js").asFile.exists())
            throw GradleException("node_modules is missing: run `npm ci` in the repo root first")
    }
}
tasks.named("preBuild") { dependsOn(copyWebAssets) }

// ---- release signing (as Daybook) -------------------------------------------------------------
//
// The key lives offline with Joseph. CI restores it from repo secrets into these env vars (or pass
// them as -P gradle properties). Locals are ks*, not keyAlias/keyPassword: those are SigningConfig's
// own property names and would shadow these inside the block.
fun secret(name: String) = (findProperty(name) as String?) ?: System.getenv(name).orEmpty()
val ksPath = secret("DRILL_KEYSTORE")
val ksPassword = secret("DRILL_KEYSTORE_PASSWORD")
val ksAlias = secret("DRILL_KEY_ALIAS")
val ksKeyPassword = secret("DRILL_KEY_PASSWORD")
val haveReleaseKey = listOf(ksPath, ksPassword, ksAlias, ksKeyPassword).all { it.isNotBlank() } && File(ksPath).exists()

// A green build is not proof of a signed APK: with no key AGP quietly writes app-release-unsigned.apk.
// Release builds pass -PrequireSigning=true, which turns that into a failure.
if ((findProperty("requireSigning") as String?).toBoolean() && !haveReleaseKey) {
    throw GradleException(
        "-PrequireSigning was set but the release key is not available. Need DRILL_KEYSTORE " +
            "(exists: ${ksPath.isNotBlank() && File(ksPath).exists()}), DRILL_KEYSTORE_PASSWORD " +
            "(set: ${ksPassword.isNotBlank()}), DRILL_KEY_ALIAS (set: ${ksAlias.isNotBlank()}), " +
            "DRILL_KEY_PASSWORD (set: ${ksKeyPassword.isNotBlank()})."
    )
}

android {
    namespace = "com.joebywan.drill"
    compileSdk = 36

    defaultConfig {
        // Locked: changing it after the first release makes every installed copy un-updatable.
        applicationId = "com.joebywan.drill"
        minSdk = 26
        targetSdk = 36
        // CI supplies a rising versionCode for every release; local builds get 1.
        versionCode = (System.getenv("DRILL_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("DRILL_VERSION_NAME") ?: "0.1.0"
    }

    sourceSets["main"].assets.directories.add(webAssets.get().asFile.path)

    signingConfigs {
        if (haveReleaseKey) {
            create("release") {
                storeFile = File(ksPath)
                storePassword = ksPassword
                keyAlias = ksAlias
                keyPassword = ksKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            // Explicit: a debuggable APK is what Play Protect scrutinises hardest on update.
            isDebuggable = false
            // Off: the JS bridge is called by name from the page, and shrinking would buy little.
            isMinifyEnabled = false
            signingConfig = if (haveReleaseKey) signingConfigs.getByName("release") else null
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.work:work-runtime:2.10.0")
}
