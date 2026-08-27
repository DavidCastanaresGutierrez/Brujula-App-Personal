# Brújula Wear does not use reflection-based serialization.

# Tink references these compile-time annotations, but they are not required at runtime.
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn javax.annotation.concurrent.**
