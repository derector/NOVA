import org.gradle.api.GradleException
import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val debugApiBase = providers.environmentVariable("NOVA_API_BASE_URL").orElse("http://10.0.2.2:3001").get()
val releaseApiBase = providers.environmentVariable("NOVA_API_BASE_URL").orElse("").get()
val releaseStoreFile = providers.environmentVariable("NOVA_RELEASE_STORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("NOVA_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("NOVA_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("NOVA_RELEASE_KEY_PASSWORD").orNull

android {
    namespace = "io.nova.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.nova.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", "\"$debugApiBase\"")
    }

    signingConfigs {
        create("release") {
            releaseStoreFile?.let { storeFile = File(it) }
            releaseStorePassword?.let { storePassword = it }
            releaseKeyAlias?.let { keyAlias = it }
            releaseKeyPassword?.let { keyPassword = it }
        }
    }

    buildTypes {
        debug {
            isDebuggable = true
            manifestPlaceholders["allowCleartext"] = "true"
        }
        release {
            isMinifyEnabled = false
            manifestPlaceholders["allowCleartext"] = "false"
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBase\"")
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        if (!releaseApiBase.startsWith("https://", ignoreCase = true)) {
            throw GradleException("Release builds require NOVA_API_BASE_URL to be an HTTPS URL.")
        }
        val missing = listOf(
            releaseStoreFile,
            releaseStorePassword,
            releaseKeyAlias,
            releaseKeyPassword,
        ).any { it.isNullOrBlank() }
        if (missing || releaseStoreFile == null || !File(releaseStoreFile).isFile) {
            throw GradleException("Release signing is not configured. Provide the protected NOVA_RELEASE_* signing environment variables.")
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("io.socket:socket.io-client:2.1.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlin:kotlin-test:2.0.21")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
