// The Android wrapper is its own Gradle build beside the web app. The repo root (`..`) is the one
// copy of the web app; app/build.gradle.kts copies it into the APK at build time.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "Drill"
include(":app")
