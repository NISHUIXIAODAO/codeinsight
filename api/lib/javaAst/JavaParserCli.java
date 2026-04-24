import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ParseProblemException;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.ImportDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class JavaParserCli {
    private static final Set<String> IGNORE_DIRS = new HashSet<String>();
    static {
        String[] dirs = new String[] {".git",".idea",".vscode","node_modules","dist","build","out","coverage",".next",".nuxt","target",".venv","venv","__pycache__"};
        for (String d : dirs) IGNORE_DIRS.add(d);
    }

    private static String toPosix(String p) {
        return p.replace('\\', '/');
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int)c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    private static List<Path> walkJavaFiles(Path root, int maxFiles) throws Exception {
        List<Path> out = new ArrayList<Path>();
        List<Path> stack = new ArrayList<Path>();
        stack.add(root);
        while (!stack.isEmpty()) {
            Path dir = stack.remove(stack.size() - 1);
            File[] entries = dir.toFile().listFiles();
            if (entries == null) continue;
            for (File f : entries) {
                if (f.isDirectory()) {
                    if (IGNORE_DIRS.contains(f.getName())) continue;
                    stack.add(f.toPath());
                    continue;
                }
                if (!f.isFile()) continue;
                if (!f.getName().toLowerCase().endsWith(".java")) continue;
                out.add(f.toPath());
                if (out.size() >= maxFiles) return out;
            }
        }
        return out;
    }

    private static String readUtf8(Path p) {
        try {
            BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(p.toFile()), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
            br.close();
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.out.print("{}");
            return;
        }
        String rootDir = args[0];
        int maxFiles = 4000;
        if (args.length >= 2) {
            try { maxFiles = Integer.parseInt(args[1]); } catch (Exception ignored) {}
        }
        Path root = Paths.get(rootDir).toAbsolutePath().normalize();
        if (!Files.exists(root)) {
            System.out.print("{}");
            return;
        }

        List<Path> files = walkJavaFiles(root, maxFiles);
        Map<String, Object> index = new HashMap<String, Object>();

        for (Path file : files) {
            String rel = toPosix(root.relativize(file.toAbsolutePath().normalize()).toString());
            String code = readUtf8(file);
            if (code.isEmpty()) continue;
            try {
                CompilationUnit cu = StaticJavaParser.parse(code);
                final String pkgName = cu.getPackageDeclaration().isPresent() ? cu.getPackageDeclaration().get().getNameAsString() : "";
                final List<Map<String, Object>> classes = new ArrayList<Map<String, Object>>();
                final List<Map<String, String>> imports = new ArrayList<Map<String, String>>();

                for (ImportDeclaration imp : cu.getImports()) {
                    String spec = imp.getNameAsString();
                    if (imp.isAsterisk()) spec = spec + ".*";
                    Map<String, String> row = new HashMap<String, String>();
                    row.put("spec", spec);
                    imports.add(row);
                }

                cu.accept(new VoidVisitorAdapter<Void>() {
                    @Override
                    public void visit(ClassOrInterfaceDeclaration n, Void arg) {
                        if (n.getName() != null) {
                            Map<String, Object> c = new HashMap<String, Object>();
                            String cn = n.getNameAsString();
                            c.put("name", cn);
                            c.put("fqn", pkgName.isEmpty() ? cn : (pkgName + "." + cn));
                            c.put("isInterface", n.isInterface());

                            List<String> anns = new ArrayList<String>();
                            for (int i = 0; i < n.getAnnotations().size(); i++) {
                                String an = n.getAnnotations().get(i).getNameAsString();
                                if (an != null && !an.isEmpty()) anns.add(an);
                            }
                            c.put("annotations", anns);

                            List<String> exts = new ArrayList<String>();
                            for (int i = 0; i < n.getExtendedTypes().size(); i++) {
                                String t = n.getExtendedTypes().get(i).getNameAsString();
                                if (t != null && !t.isEmpty()) exts.add(t);
                            }
                            c.put("extends", exts);

                            List<String> impls = new ArrayList<String>();
                            for (int i = 0; i < n.getImplementedTypes().size(); i++) {
                                String t = n.getImplementedTypes().get(i).getNameAsString();
                                if (t != null && !t.isEmpty()) impls.add(t);
                            }
                            c.put("implements", impls);

                            List<String> ms = new ArrayList<String>();
                            for (int i = 0; i < n.getMethods().size(); i++) {
                                ms.add(n.getMethods().get(i).getNameAsString());
                            }
                            c.put("methods", ms);

                            List<Map<String, String>> injects = new ArrayList<Map<String, String>>();
                            for (FieldDeclaration fd : n.getFields()) {
                                boolean inject = false;
                                String via = "";
                                for (int ai = 0; ai < fd.getAnnotations().size(); ai++) {
                                    String an = fd.getAnnotations().get(ai).getNameAsString();
                                    if ("Autowired".equals(an) || "Resource".equals(an) || "Inject".equals(an)) {
                                        inject = true;
                                        via = an;
                                    }
                                }
                                if (!inject) continue;
                                for (int vi = 0; vi < fd.getVariables().size(); vi++) {
                                    String ty = fd.getVariables().get(vi).getType().asString();
                                    if (ty == null || ty.isEmpty()) continue;
                                    Map<String, String> row = new HashMap<String, String>();
                                    row.put("type", ty);
                                    row.put("kind", "field");
                                    row.put("via", via);
                                    injects.add(row);
                                }
                            }
                            for (ConstructorDeclaration cd : n.getConstructors()) {
                                boolean inject = false;
                                String via = "";
                                for (int ai = 0; ai < cd.getAnnotations().size(); ai++) {
                                    String an = cd.getAnnotations().get(ai).getNameAsString();
                                    if ("Autowired".equals(an) || "Inject".equals(an)) {
                                        inject = true;
                                        via = an;
                                    }
                                }
                                if (!inject && n.getConstructors().size() == 1) {
                                    inject = true;
                                    via = "constructor";
                                }
                                if (!inject) continue;
                                for (Parameter p : cd.getParameters()) {
                                    String ty = p.getType().asString();
                                    if (ty == null || ty.isEmpty()) continue;
                                    Map<String, String> row = new HashMap<String, String>();
                                    row.put("type", ty);
                                    row.put("kind", "constructor");
                                    row.put("via", via);
                                    injects.add(row);
                                }
                            }
                            c.put("injects", injects);

                            classes.add(c);
                        }
                        super.visit(n, arg);
                    }
                }, null);

                Map<String, Object> info = new HashMap<String, Object>();
                info.put("package", pkgName);
                info.put("classes", classes);
                info.put("imports", imports);
                index.put(rel, info);
            } catch (ParseProblemException ignored) {
            } catch (Exception ignored) {
            }
        }

        StringBuilder out = new StringBuilder();
        out.append("{");
        boolean firstFile = true;
        for (Map.Entry<String, Object> e : index.entrySet()) {
            if (!firstFile) out.append(",");
            firstFile = false;
            String rel = e.getKey();
            Map info = (Map) e.getValue();
            List<Map<String, Object>> classes = (List<Map<String, Object>>) info.get("classes");
            List<Map<String, String>> imports = (List<Map<String, String>>) info.get("imports");

            out.append("\"").append(escapeJson(rel)).append("\":{");

            String pkgName = (String) info.get("package");
            out.append("\"package\":\"").append(escapeJson(pkgName)).append("\",");

            out.append("\"classes\":[");
            for (int i = 0; i < classes.size(); i++) {
                if (i > 0) out.append(",");
                Map<String, Object> c = classes.get(i);
                String cn = (String) c.get("name");
                String fqn = (String) c.get("fqn");
                List<String> ms = (List<String>) c.get("methods");
                Boolean isInterface = (Boolean) c.get("isInterface");
                List<String> anns = (List<String>) c.get("annotations");
                List<String> exts = (List<String>) c.get("extends");
                List<String> impls = (List<String>) c.get("implements");
                List<Map<String, String>> injects = (List<Map<String, String>>) c.get("injects");

                out.append("{\"name\":\"").append(escapeJson(cn)).append("\",\"fqn\":\"").append(escapeJson(fqn)).append("\"");
                out.append(",\"isInterface\":").append(isInterface != null && isInterface.booleanValue() ? "true" : "false");

                out.append(",\"annotations\":[");
                if (anns != null) {
                    for (int j = 0; j < anns.size(); j++) {
                        if (j > 0) out.append(",");
                        out.append("\"").append(escapeJson(anns.get(j))).append("\"");
                    }
                }
                out.append("]");

                out.append(",\"extends\":[");
                if (exts != null) {
                    for (int j = 0; j < exts.size(); j++) {
                        if (j > 0) out.append(",");
                        out.append("\"").append(escapeJson(exts.get(j))).append("\"");
                    }
                }
                out.append("]");

                out.append(",\"implements\":[");
                if (impls != null) {
                    for (int j = 0; j < impls.size(); j++) {
                        if (j > 0) out.append(",");
                        out.append("\"").append(escapeJson(impls.get(j))).append("\"");
                    }
                }
                out.append("]");

                out.append(",\"methods\":[");
                for (int j = 0; j < ms.size(); j++) {
                    if (j > 0) out.append(",");
                    out.append("\"").append(escapeJson(ms.get(j))).append("\"");
                }
                out.append("]");

                out.append(",\"injects\":[");
                if (injects != null) {
                    for (int j = 0; j < injects.size(); j++) {
                        if (j > 0) out.append(",");
                        Map<String, String> row = injects.get(j);
                        out.append("{\"type\":\"").append(escapeJson(row.get("type"))).append("\"");
                        out.append(",\"kind\":\"").append(escapeJson(row.get("kind"))).append("\"");
                        out.append(",\"via\":\"").append(escapeJson(row.get("via"))).append("\"}");
                    }
                }
                out.append("]");

                out.append("}");
            }
            out.append("],");

            out.append("\"imports\":[");
            for (int i = 0; i < imports.size(); i++) {
                if (i > 0) out.append(",");
                Map<String, String> row = imports.get(i);
                out.append("{\"spec\":\"").append(escapeJson(row.get("spec"))).append("\"}");
            }
            out.append("]");

            out.append("}");
        }
        out.append("}");
        System.out.print(out.toString());
    }
}
