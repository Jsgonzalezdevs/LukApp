plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

// El repo vive en ~/Documents, que iCloud sincroniza: mientras Gradle escribe,
// iCloud crea copias de conflicto ("Clase$1 2.class") y D8 falla con "defined
// multiple times". La salida de compilación va a una caché local fuera de iCloud.
// Se puede cambiar con -Plukapp.dirCompilacion=/otra/ruta.
val dirCompilacion: String = providers.gradleProperty("lukapp.dirCompilacion").orNull
    ?: "${System.getProperty("user.home")}/Library/Caches/lukapp-android"
allprojects {
    layout.buildDirectory.set(file("$dirCompilacion/${project.name}"))
}
