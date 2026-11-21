FROM eclipse-temurin:21-jdk-alpine
# Compile the harness and warm javac/JDK classes once into immutable layers.
# Exercises need no Maven/Gradle/JUnit downloads or shared writable caches.
COPY server/java/PracticeRunner.java /tmp/PracticeRunner.java
RUN mkdir -p /opt/workbench/java/classes \
    && javac --release 21 -d /opt/workbench/java/classes /tmp/PracticeRunner.java \
    && jar --create --file /opt/workbench/java/runner.jar -C /opt/workbench/java/classes . \
    && rm -rf /opt/workbench/java/classes /tmp/PracticeRunner.java \
    && printf '%s\n' 'public class WarmupTest { public static void main(String[] args) { assert 2+2 == 4; } }' > /tmp/WarmupTest.java \
    && java -Xmx128m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 \
        -XX:ArchiveClassesAtExit=/opt/workbench/java/classes.jsa \
        -cp /opt/workbench/java/runner.jar PracticeRunner /tmp/WarmupTest.java \
    && rm /tmp/WarmupTest.java
CMD ["java", "-version"]
