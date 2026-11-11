import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// La versión sale de src/version.ts para que web y Android nunca digan cosas distintas.
val versionLukApp: String = rootDir.resolve("../../src/version.ts").readText()
    .let { Regex("""export const VERSION = '(\d+\.\d+\.\d+)'""").find(it)!!.groupValues[1] }

// Mismo esquema que la app Expo (10.14.0 → 1014000) para que Play acepte la nativa como actualización.
val codigoVersion: Int = versionLukApp.split(".").map(String::toInt)
    .let { (mayor, menor, parche) -> mayor * 100_000 + menor * 1_000 + parche }

// Los valores públicos (URL de Supabase, clave publishable, client id web de Google) se
// leen fuera del repositorio: lukapp.properties primero y, si falta, el .env de la app Expo.
val configuracion = Properties().apply {
    rootDir.resolve("../mobile/.env").takeIf { it.exists() }?.readLines()?.forEach { linea ->
        val (clave, valor) = linea.split("=", limit = 2).takeIf { it.size == 2 } ?: return@forEach
        when (clave.trim()) {
            "EXPO_PUBLIC_SUPABASE_URL" -> setProperty("SUPABASE_URL", valor.trim())
            "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" -> setProperty("SUPABASE_KEY", valor.trim())
        }
    }
    rootDir.resolve("lukapp.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun config(clave: String, porDefecto: String = ""): String =
    (System.getenv("LUKAPP_$clave") ?: configuracion.getProperty(clave) ?: porDefecto)

android {
    namespace = "app.lukapp"
    compileSdk = 37

    defaultConfig {
        // Identificador ya registrado en Play Console: cambiarlo sería publicar otra app.
        applicationId = "lukApp.App"
        minSdk = 26
        targetSdk = 36
        versionCode = codigoVersion
        versionName = versionLukApp

        buildConfigField("String", "SUPABASE_URL", "\"${config("SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_KEY", "\"${config("SUPABASE_KEY")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${config("GOOGLE_WEB_CLIENT_ID")}\"")
        buildConfigField("String", "API_URL", "\"${config("API_URL", "https://focus-62nt.onrender.com")}\"")
    }

    signingConfigs {
        create("publicacion") {
            val almacen = config("UPLOAD_STORE_FILE")
            if (almacen.isNotBlank()) {
                storeFile = file(almacen)
                storePassword = config("UPLOAD_STORE_PASSWORD")
                keyAlias = config("UPLOAD_KEY_ALIAS")
                keyPassword = config("UPLOAD_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Se instala al lado de la de Play sin pisar sus datos, igual que el perfil preview de Expo.
            applicationIdSuffix = ".nativa.debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (config("UPLOAD_STORE_FILE").isNotBlank()) signingConfig = signingConfigs.getByName("publicacion")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions { unitTests.isReturnDefaultValues = true }

    // Los logos de bancos se toman de public/bancos, los mismos archivos que usa la web:
    // así una marca nueva o corregida llega a Android sin copiarla a mano.
    sourceSets["main"].assets.directories.add(layout.buildDirectory.dir("generated/assetsMarca").get().asFile.path)
}

val copiarLogosBancos by tasks.registering(Sync::class) {
    from(rootDir.resolve("../../public/bancos")) { include("*.svg", "*.png") }
    into(layout.buildDirectory.dir("generated/assetsMarca/bancos"))
}
tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach { dependsOn(copiarLogosBancos) }
tasks.matching { it.name.contains("generate") && it.name.endsWith("Assets") }.configureEach { dependsOn(copiarLogosBancos) }

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play)
    implementation(libs.googleid)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)

    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.functions)
    implementation(libs.ktor.okhttp)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.coil.compose)
    implementation(libs.coil.svg)

    testImplementation(libs.junit)
}
