package com.codeinsight.api.service;

import com.codeinsight.api.dto.GraphData;
import com.codeinsight.api.dto.GraphLink;
import com.codeinsight.api.dto.GraphNode;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.FileVisitor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RepoGraphService {
    private static final Set<String> DEFAULT_IGNORE_DIRS = new HashSet<>();
    static {
        DEFAULT_IGNORE_DIRS.add(".git");
        DEFAULT_IGNORE_DIRS.add(".idea");
        DEFAULT_IGNORE_DIRS.add(".vscode");
        DEFAULT_IGNORE_DIRS.add("node_modules");
        DEFAULT_IGNORE_DIRS.add("dist");
        DEFAULT_IGNORE_DIRS.add("build");
        DEFAULT_IGNORE_DIRS.add("out");
        DEFAULT_IGNORE_DIRS.add("coverage");
        DEFAULT_IGNORE_DIRS.add(".next");
        DEFAULT_IGNORE_DIRS.add(".nuxt");
        DEFAULT_IGNORE_DIRS.add("target");
        DEFAULT_IGNORE_DIRS.add(".venv");
        DEFAULT_IGNORE_DIRS.add("venv");
        DEFAULT_IGNORE_DIRS.add("__pycache__");
    }

    public GraphData buildGraph(String rootPath) throws IOException {
        Path root = Paths.get(rootPath).toAbsolutePath().normalize();
        if (!Files.exists(root) || !Files.isDirectory(root)) {
            return new GraphData(new ArrayList<GraphNode>(), new ArrayList<GraphLink>());
        }

        Map<String, GraphNode> nodesById = new LinkedHashMap<>();
        List<GraphLink> links = new ArrayList<>();
        Set<String> linkKey = new LinkedHashSet<>();

        Map<String, String> classIdByFqn = new HashMap<>();
        Map<String, List<String>> fqnBySimple = new HashMap<>();
        Map<String, List<String>> importsByRel = new HashMap<>();
        Map<String, String> packageByRel = new HashMap<>();

        List<Path> javaFiles = new ArrayList<>();
        Files.walkFileTree(root, new FileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                String name = dir.getFileName() == null ? "" : dir.getFileName().toString();
                if (DEFAULT_IGNORE_DIRS.contains(name)) return FileVisitResult.SKIP_SUBTREE;
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (attrs.isRegularFile() && file.toString().toLowerCase().endsWith(".java")) {
                    javaFiles.add(file);
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) {
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc) {
                return FileVisitResult.CONTINUE;
            }
        });

        Map<Path, String> relByAbs = new HashMap<>();
        for (Path abs : javaFiles) {
            String rel = toPosix(root.relativize(abs).toString());
            relByAbs.put(abs, rel);
            String pkg = packageNameFromRel(rel);
            packageByRel.put(rel, pkg);
            ensureNode(nodesById, rel, abs.getFileName().toString(), "file", pkg, null, null, null, null, null, null, null);
        }

        for (Path abs : javaFiles) {
            String rel = relByAbs.get(abs);
            if (rel == null) continue;
            CompilationUnit cu;
            try {
                cu = StaticJavaParser.parse(abs);
            } catch (Exception e) {
                continue;
            }

            String pkgDecl = cu.getPackageDeclaration().map(p -> p.getNameAsString()).orElse("");
            List<String> importSpecs = cu.getImports().stream()
                    .filter(i -> !i.isStatic())
                    .map(i -> i.getNameAsString() + (i.isAsterisk() ? ".*" : ""))
                    .collect(Collectors.toList());
            importsByRel.put(rel, importSpecs);

            for (ClassOrInterfaceDeclaration c : cu.findAll(ClassOrInterfaceDeclaration.class)) {
                if (!c.isTopLevelType()) continue;
                String simple = c.getNameAsString();
                String fqn = (pkgDecl == null || pkgDecl.trim().isEmpty()) ? simple : pkgDecl + "." + simple;
                String classId = "java:" + fqn;

                List<String> annotations = c.getAnnotations().stream()
                        .map(a -> a.getName().getIdentifier())
                        .collect(Collectors.toList());
                boolean isInterface = c.isInterface();
                String role = JavaRoleClassifier.classify(pkgDecl, simple, annotations, isInterface);

                classIdByFqn.put(fqn, classId);
                fqnBySimple.computeIfAbsent(simple, k -> new ArrayList<>()).add(fqn);

                ensureNode(nodesById, classId, simple, "class", pkgDecl, "java", role, fqn, isInterface, annotations, null, null);
                addLink(links, linkKey, rel, classId, "contains", null);

                for (MethodDeclaration m : c.getMethods()) {
                    String mid = "java:" + fqn + "#" + m.getNameAsString();
                    ensureNode(nodesById, mid, m.getNameAsString(), "function", pkgDecl, "java", role, null, null, null, null, fqn);
                    addLink(links, linkKey, classId, mid, "contains", null);
                }
            }
        }

        for (Path abs : javaFiles) {
            String rel = relByAbs.get(abs);
            if (rel == null) continue;
            CompilationUnit cu;
            try {
                cu = StaticJavaParser.parse(abs);
            } catch (Exception e) {
                continue;
            }

            String pkgDecl = cu.getPackageDeclaration().map(p -> p.getNameAsString()).orElse("");
            List<String> importSpecs = importsByRel.containsKey(rel) ? importsByRel.get(rel) : new ArrayList<String>();

            for (String spec : importSpecs) {
                String to = resolveJavaTarget(spec, pkgDecl, importSpecs, classIdByFqn, fqnBySimple);
                if (to == null) continue;
                if (to.startsWith("ext:")) ensureNode(nodesById, to, spec, "external", "", "java", null, null, null, null, null, null);
                addLink(links, linkKey, rel, to, "import", null);
            }

            for (ClassOrInterfaceDeclaration c : cu.findAll(ClassOrInterfaceDeclaration.class)) {
                if (!c.isTopLevelType()) continue;
                String simple = c.getNameAsString();
                String fqn = (pkgDecl == null || pkgDecl.trim().isEmpty()) ? simple : pkgDecl + "." + simple;
                String classId = classIdByFqn.get(fqn);
                if (classId == null) continue;

                for (ClassOrInterfaceType t : c.getExtendedTypes()) {
                    String to = resolveJavaTarget(t.toString(), pkgDecl, importSpecs, classIdByFqn, fqnBySimple);
                    if (to == null) continue;
                    if (to.startsWith("ext:")) ensureNode(nodesById, to, t.toString(), "external", "", "java", null, null, null, null, null, null);
                    addLink(links, linkKey, classId, to, "extends", null);
                }

                for (ClassOrInterfaceType t : c.getImplementedTypes()) {
                    String to = resolveJavaTarget(t.toString(), pkgDecl, importSpecs, classIdByFqn, fqnBySimple);
                    if (to == null) continue;
                    if (to.startsWith("ext:")) ensureNode(nodesById, to, t.toString(), "external", "", "java", null, null, null, null, null, null);
                    addLink(links, linkKey, classId, to, "implements", null);
                }

                Set<String> injectTargets = new LinkedHashSet<>();
                c.getFields().forEach(f -> {
                    List<String> anns = f.getAnnotations().stream().map(a -> a.getName().getIdentifier()).collect(Collectors.toList());
                    if (!hasInjectAnnotation(anns)) return;
                    f.getVariables().forEach(v -> injectTargets.add(v.getType().toString()));
                });
                List<ConstructorDeclaration> ctors = c.getConstructors();
                boolean anyAutowiredCtor = false;
                for (ConstructorDeclaration x : ctors) {
                    List<String> anns = x.getAnnotations().stream().map(a -> a.getName().getIdentifier()).collect(Collectors.toList());
                    if (hasInjectAnnotation(anns)) {
                        anyAutowiredCtor = true;
                        break;
                    }
                }
                if (ctors.size() == 1 || anyAutowiredCtor) {
                    for (ConstructorDeclaration ctor : ctors) {
                        List<String> anns = ctor.getAnnotations().stream().map(a -> a.getName().getIdentifier()).collect(Collectors.toList());
                        boolean ok = ctors.size() == 1 || hasInjectAnnotation(anns);
                        if (!ok) continue;
                        for (Parameter p : ctor.getParameters()) {
                            injectTargets.add(p.getType().toString());
                        }
                    }
                }
                for (String t : injectTargets) {
                    String to = resolveJavaTarget(t, pkgDecl, importSpecs, classIdByFqn, fqnBySimple);
                    if (to == null) continue;
                    if (to.startsWith("ext:")) ensureNode(nodesById, to, t, "external", "", "java", null, null, null, null, null, null);
                    addLink(links, linkKey, classId, to, "injects", null);
                }
            }
        }

        return new GraphData(new ArrayList<>(nodesById.values()), links);
    }

    private static boolean hasInjectAnnotation(List<String> annotations) {
        if (annotations == null) return false;
        for (String a : annotations) {
            if (a == null) continue;
            String s = a.toLowerCase();
            if (s.equals("autowired") || s.equals("resource") || s.equals("inject")) return true;
        }
        return false;
    }

    private static String packageNameFromRel(String rel) {
        String dir = toPosix(Paths.get(rel).getParent() == null ? "" : Paths.get(rel).getParent().toString());
        if (dir.equals(".")) return "";
        return dir;
    }

    private static String toPosix(String p) {
        return p.replace('\\', '/');
    }

    private static void ensureNode(
            Map<String, GraphNode> nodesById,
            String id,
            String name,
            String type,
            String packageName,
            String language,
            String role,
            String fqn,
            Boolean isInterface,
            List<String> stereotypes,
            Integer count,
            String owner
    ) {
        if (nodesById.containsKey(id)) return;
        nodesById.put(id, new GraphNode(id, name, type, packageName, language, role, fqn, isInterface, stereotypes, count, owner));
    }

    private static void addLink(List<GraphLink> links, Set<String> linkKey, String source, String target, String type, Integer count) {
        String key = source + "->" + target + ":" + type;
        if (!linkKey.add(key)) return;
        links.add(new GraphLink(source, target, type, count));
    }

    private static String normalizeJavaType(String typeName) {
        if (typeName == null) return null;
        String s = typeName.trim();
        if (s.isEmpty()) return null;
        s = s.replaceAll("\\s+", " ");
        s = s.replaceAll("<.*>", "");
        s = s.replaceAll("\\[\\]$", "");
        s = s.replaceAll("\\s", "");
        return s.isEmpty() ? null : s;
    }

    private static String resolveJavaTarget(
            String spec,
            String currentPackage,
            List<String> imports,
            Map<String, String> classIdByFqn,
            Map<String, List<String>> fqnBySimple
    ) {
        String s = normalizeJavaType(spec);
        if (s == null) return null;
        if (s.startsWith("java.") || s.startsWith("javax.") || s.startsWith("jakarta.")) return null;

        if (s.contains(".")) {
            String fqn = s.endsWith(".*") ? s : s;
            if (!fqn.endsWith(".*") && classIdByFqn.containsKey(fqn)) return classIdByFqn.get(fqn);
            return "ext:java:" + s;
        }

        if (currentPackage != null && !currentPackage.trim().isEmpty()) {
            String maybe = currentPackage + "." + s;
            if (classIdByFqn.containsKey(maybe)) return classIdByFqn.get(maybe);
        }

        if (imports != null) {
            for (String imp : imports) {
                if (imp == null || imp.trim().isEmpty()) continue;
                String is = normalizeJavaType(imp);
                if (is == null) continue;
                if (is.endsWith(".*")) {
                    String p = is.substring(0, is.length() - 2);
                    String maybe = p + "." + s;
                    if (classIdByFqn.containsKey(maybe)) return classIdByFqn.get(maybe);
                } else if (is.endsWith("." + s) && classIdByFqn.containsKey(is)) {
                    return classIdByFqn.get(is);
                }
            }
        }

        List<String> candidates = fqnBySimple.get(s);
        if (candidates != null && candidates.size() == 1) {
            String only = candidates.get(0);
            if (classIdByFqn.containsKey(only)) return classIdByFqn.get(only);
            return "ext:java:" + only;
        }

        return "ext:java:" + s;
    }
}
