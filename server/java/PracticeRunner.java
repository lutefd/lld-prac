import java.lang.reflect.InvocationTargetException;
import java.net.URLClassLoader;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;
import javax.tools.ToolProvider;

/** Dependency-free runner: compile the snapshot once, run all tests in one JVM. */
public final class PracticeRunner {
    public static void main(String[] sources) throws Exception {
        System.exit(run(sources));
    }

    private static int run(String[] sources) throws Exception {
        var compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("Java tests require a JDK (Java 21+), not a JRE");
        var output = Files.createTempDirectory("workbench-java-");
        try {
            var arguments = new ArrayList<String>(List.of("--release", "21", "-encoding", "UTF-8", "-d", output.toString()));
            arguments.addAll(Arrays.asList(sources));
            if (compiler.run(null, System.out, System.err, arguments.toArray(String[]::new)) != 0) return 1;
            int failures = 0;
            int tests = 0;
            try (var loader = new URLClassLoader(new java.net.URL[]{output.toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
                loader.setDefaultAssertionStatus(true);
                for (var source : sources) {
                    var filename = Path.of(source).getFileName().toString();
                    if (!filename.endsWith("Test.java") && !filename.startsWith("Test")) continue;
                    var name = filename.substring(0, filename.length() - 5);
                    var pkg = Pattern.compile("(?m)^\\s*package\\s+([\\w.]+)\\s*;").matcher(Files.readString(Path.of(source)));
                    if (pkg.find()) name = pkg.group(1) + "." + name;
                    tests++;
                    System.out.println("RUN " + name);
                    try {
                        var method = loader.loadClass(name).getMethod("main", String[].class);
                        method.invoke(null, (Object) new String[0]);
                        System.out.println("PASS " + name);
                    } catch (Throwable error) {
                        failures++;
                        System.out.println("FAIL " + name);
                        (error instanceof InvocationTargetException invocation ? invocation.getCause() : error).printStackTrace(System.out);
                    }
                }
            }
            if (tests == 0) throw new IllegalStateException("No Java tests found; add a *Test.java class with public static void main(String[] args)");
            System.out.println(tests + " test classes, " + failures + " failed");
            return failures > 0 ? 1 : 0;
        } finally {
            try (var paths = Files.walk(output)) {
                for (var item : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(item);
            }
        }
    }
}
