plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.ranjithkb.radionative"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.ranjithkb.radio"   // same as the earlier Radio app, so it updates in place
        minSdk = 26
        targetSdk = 35
        versionCode = 2000 + (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()   // above every earlier Radio build
        versionName = System.getenv("APP_VERSION") ?: "2.0.0"
    }
    signingConfigs {
        create("shared") {
            val ks = System.getenv("RADIO_KEYSTORE_PATH")
            if (ks != null && file(ks).exists()) {
                storeFile = file(ks); storePassword = System.getenv("RADIO_KEYSTORE_PASSWORD")
                keyAlias = "radio"; keyPassword = System.getenv("RADIO_KEYSTORE_PASSWORD")
            } else {
                storeFile = file(System.getProperty("user.home") + "/.android/debug.keystore")
                storePassword = "android"; keyAlias = "androiddebugkey"; keyPassword = "android"
            }
        }
    }
    buildTypes {
        release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("shared") }
        debug { signingConfig = signingConfigs.getByName("shared") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}
dependencies {
    val media3 = "1.5.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-session:$media3")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("com.google.guava:guava:33.3.1-android")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-guava:1.9.0")
}
