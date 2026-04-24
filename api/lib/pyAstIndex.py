import ast
import json
import os
import sys

IGNORE_DIRS = {
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    ".next",
    ".nuxt",
    "target",
    ".venv",
    "venv",
    "__pycache__",
}


def to_posix(p: str) -> str:
    return p.replace("\\", "/")


def is_ignored_dir(name: str) -> bool:
    return name in IGNORE_DIRS


def safe_read_text(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def find_module_file(abs_root: str, module: str):
    if not module:
        return None
    rel = module.replace(".", "/")
    cand1 = os.path.join(abs_root, rel + ".py")
    cand2 = os.path.join(abs_root, rel, "__init__.py")
    if os.path.isfile(cand1):
        return cand1
    if os.path.isfile(cand2):
        return cand2
    return None


def resolve_relative(abs_root: str, from_file: str, level: int, module: str):
    base_dir = os.path.dirname(from_file)
    for _ in range(max(level - 1, 0)):
        base_dir = os.path.dirname(base_dir)
    parts = []
    if module:
        parts = module.split(".")
    rel_path = os.path.join(base_dir, *parts) if parts else base_dir
    cand1 = rel_path + ".py"
    cand2 = os.path.join(rel_path, "__init__.py")
    if os.path.isfile(cand1):
        return cand1
    if os.path.isfile(cand2):
        return cand2
    return None


def extract_for_file(abs_root: str, file_path: str):
    code = safe_read_text(file_path)
    if not code:
        return {"imports": [], "classes": [], "functions": []}

    try:
        tree = ast.parse(code)
    except Exception:
        return {"imports": [], "classes": [], "functions": []}

    imports = []
    classes = []
    functions = []

    for node in getattr(tree, "body", []):
        if isinstance(node, ast.ClassDef):
            if getattr(node, "name", None):
                classes.append(node.name)
        if isinstance(node, ast.FunctionDef):
            if getattr(node, "name", None):
                functions.append(node.name)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in getattr(node, "names", []):
                spec = getattr(alias, "name", None)
                resolved = None
                if spec:
                    resolved_abs = find_module_file(abs_root, spec)
                    resolved = to_posix(os.path.relpath(resolved_abs, abs_root)) if resolved_abs else None
                    imports.append({"spec": spec, "resolved": resolved})
        if isinstance(node, ast.ImportFrom):
            module = getattr(node, "module", None) or ""
            level = getattr(node, "level", 0) or 0
            spec = ("." * level) + module if level else module
            resolved = None
            if level:
                resolved_abs = resolve_relative(abs_root, file_path, level, module)
                resolved = to_posix(os.path.relpath(resolved_abs, abs_root)) if resolved_abs else None
            else:
                resolved_abs = find_module_file(abs_root, module)
                resolved = to_posix(os.path.relpath(resolved_abs, abs_root)) if resolved_abs else None
            if spec:
                imports.append({"spec": spec, "resolved": resolved})

    return {"imports": imports, "classes": classes, "functions": functions}


def main():
    if len(sys.argv) < 2:
        print("{}")
        return
    abs_root = os.path.abspath(sys.argv[1])
    max_files = 4000
    if len(sys.argv) >= 3:
        try:
            max_files = int(sys.argv[2])
        except Exception:
            max_files = 4000

    out = {}
    count = 0

    for root, dirs, files in os.walk(abs_root):
        dirs[:] = [d for d in dirs if not is_ignored_dir(d)]
        for fn in files:
            if not fn.endswith(".py"):
                continue
            abs_file = os.path.join(root, fn)
            rel = to_posix(os.path.relpath(abs_file, abs_root))
            out[rel] = extract_for_file(abs_root, abs_file)
            count += 1
            if count >= max_files:
                break
        if count >= max_files:
            break

    sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()

