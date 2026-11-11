# kotlinx.serialization: conserva los serializadores generados de los modelos de datos.
-keepattributes *Annotation*, InnerClasses
-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class app.lukapp.datos.modelos.** { *; }
-dontwarn org.slf4j.**
