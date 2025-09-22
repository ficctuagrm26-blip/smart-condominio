// android/app/build.gradle.kts
plugins {
    id("com.android.application")
    id("kotlin-android")
    // El plugin de Flutter debe ir después de Android y Kotlin
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    // Mantén el mismo paquete que usarás en MainActivity y Manifest
    namespace = "com.smartcondo.movil"

    // Estos valores los provee Flutter (no los hardcodees aquí)
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    defaultConfig {
        applicationId = "com.smartcondo.movil" // ← ID único de tu app
        minSdk = flutter.minSdkVersion
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }

    buildTypes {
        // Para evitar el error de shrinkResources, o activas ambos o apagas ambos
        debug {
            isMinifyEnabled = false
            isShrinkResources = false
        }
        release {
            // Firma de debug mientras no tengas keystore propia
            signingConfig = signingConfigs.getByName("debug")

            // Si aún no vas a ofuscar, déjalo apagado
            isMinifyEnabled = false
            isShrinkResources = false

            // Si luego activas minify, activa también shrink y mantén proguard:
            // isMinifyEnabled = true
            // isShrinkResources = true
            // proguardFiles(
            //    getDefaultProguardFile("proguard-android-optimize.txt"),
            //    "proguard-rules.pro"
            // )
        }
    }

    compileOptions {
        // Usa Java 17 (recomendado con AGP recientes)
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

flutter {
    source = "../.."
}
