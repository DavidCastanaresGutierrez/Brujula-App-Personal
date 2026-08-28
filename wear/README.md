# Brújula para Wear OS

Aplicación independiente para Galaxy Watch 6. Se vincula desde `/watch-connect`, guarda una credencial revocable en el almacenamiento cifrado del reloj y consulta únicamente los hábitos del día. Mientras la aplicación está visible, actualiza automáticamente los cambios cada 30 segundos; los cambios realizados en el reloj se envían al instante y avisan al móvil mediante Supabase Realtime.

## Compilar

Abre la carpeta `wear` con Android Studio, espera la sincronización de Gradle y ejecuta la configuración `app` sobre el reloj o genera el APK con **Build → Build APK(s)**.

Para una instalación manual activa las opciones de desarrollador y la depuración inalámbrica en el reloj. Android Studio permite emparejarlo mediante **Pair Devices Using Wi-Fi**.
