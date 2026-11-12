plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.ranjithkb.radionative"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.ranjithkb.radio"   // same as the earlier Radio app, so it updates in place
        minSdk = 26
        targetSdk = 36
        versionCode = 2000 + (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()   // above every earlier Radio build
        versionName = System.getenv("APP_VERSION") ?: "2.0.0"
        // Test builds ("Radio Velvet Dev"): a separate app next to the real one, never released
        val dev = System.getenv("DEV_BUILD") == "1"
        if (dev) applicationIdSuffix = ".dev"
        resValue("string", "app_name", if (dev) "Radio Velvet Dev" else "Radio Velvet")
        manifestPlaceholders["authScheme"] = if (dev) "com.ranjithkb.radio.dev" else "com.ranjithkb.radio"
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
    // "web" = the APK on ranjithkb.com (updates itself); "play" = Google Play (Play does the updating)
    flavorDimensions += "store"
    productFlavors {
        create("web") { dimension = "store"; buildConfigField("boolean", "SELF_UPDATE", "true")
            // WhatsApp number for app notes ("whatsapp:" links): from a private build secret, never in the code
            buildConfigField("String", "WA_NUMBER", "\"" + (System.getenv("RADIO_WA_NUMBER") ?: "").filter { it.isDigit() } + "\"") }
        create("play") { dimension = "store"; buildConfigField("boolean", "SELF_UPDATE", "false")
            buildConfigField("String", "WA_NUMBER", "\"" + (System.getenv("RADIO_WA_NUMBER") ?: "").filter { it.isDigit() } + "\"") }
    }
    buildTypes {
        release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("shared") }
        debug { signingConfig = signingConfigs.getByName("shared") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    testOptions { unitTests.isIncludeAndroidResources = true }
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
    implementation("sh.calvin.reorderable:reorderable:2.4.3")
    implementation("com.google.guava:guava:33.3.1-android")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-guava:1.9.0")
    // Cast to Chromecast / Google TV / Nest speakers
    implementation("androidx.media3:media3-cast:$media3")
    implementation("androidx.mediarouter:mediarouter:1.7.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // screenshots of the screens in test builds (Robolectric, no phone needed)
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
