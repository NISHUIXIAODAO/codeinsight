import ast
import os
import requests
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")
load_dotenv()

def _safe_truncate(value, limit=2000):
    if value is None:
        return None
    s = str(value)
    if len(s) <= limit:
        return s
    return s[:limit] + "...(truncated)"

def _extract_http_error_payload(resp):
    if resp is None:
        return None
    try:
        return resp.json()
    except Exception:
        return _safe_truncate(resp.text)

def _sanitize_env_value(value):
    if value is None:
        return None
    s = str(value).strip()
    if s.startswith("`") and s.endswith("`") and len(s) >= 2:
        s = s[1:-1].strip()
    return s

def _dashscope_chat(messages, model=None):
    api_key = _sanitize_env_value(os.getenv("DASHSCOPE_API_KEY")) or ""
    if not api_key:
        raise RuntimeError("Missing DASHSCOPE_API_KEY")

    endpoint = _sanitize_env_value(
        os.getenv("DASHSCOPE_BASE_URL")
        or "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    )
    model_name = _sanitize_env_value(model) or _sanitize_env_value(os.getenv("DASHSCOPE_CHAT_MODEL")) or "qwen-max"

    resp = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "X-DashScope-Api-Key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "messages": messages,
            "temperature": 0.2,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    content = (
        (data.get("choices") or [{}])[0]
        .get("message", {})
        .get("content")
    )
    if not content:
        raise RuntimeError("Empty response from DashScope")
    return content

class CodeAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.classes = []
        self.functions = []
        self.imports = []

    def visit_ClassDef(self, node):
        methods = [m.name for m in node.body if isinstance(m, ast.FunctionDef)]
        self.classes.append({
            "name": node.name,
            "methods": methods
        })
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.functions.append(node.name)
        self.generic_visit(node)

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        module = node.module or ""
        for alias in node.names:
            self.imports.append(f"{module}.{alias.name}")
        self.generic_visit(node)

@app.route('/api/parse', methods=['POST'])
def parse_code():
    data = request.json
    code = data.get('code', '')
    try:
        tree = ast.parse(code)
        analyzer = CodeAnalyzer()
        analyzer.visit(tree)
        
        return jsonify({
            "status": "success",
            "classes": analyzer.classes,
            "functions": analyzer.functions,
            "imports": analyzer.imports
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/dependencies', methods=['GET'])
def get_dependencies():
    project_id = request.args.get('project_id')
    # TODO: Fetch from Neo4j or memory graph
    return jsonify({
        "nodes": [
            {"id": "main", "label": "Main.java", "type": "file"},
            {"id": "service", "label": "Service.java", "type": "file"}
        ],
        "edges": [
            {"source": "main", "target": "service", "label": "calls"}
        ]
    })

@app.route('/api/health', methods=['GET'])
def health():
    api_key_present = bool((os.getenv("DASHSCOPE_API_KEY") or "").strip())
    return jsonify({
        "status": "ok",
        "dashscope": {
            "api_key_present": api_key_present,
            "chat_model": _sanitize_env_value(os.getenv("DASHSCOPE_CHAT_MODEL")) or "qwen-max",
            "base_url": _sanitize_env_value(os.getenv("DASHSCOPE_BASE_URL")) or "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        },
    })

@app.route('/api/qa', methods=['POST'])
def code_qa():
    data = request.json or {}
    project_id = data.get("project_id")
    question = (data.get("question") or "").strip()
    context = (data.get("context") or "").strip()

    if not question:
        return jsonify({"error": "question is required"}), 400

    system_prompt = (
        "你是一个智能代码理解助手。你需要基于用户给出的上下文回答问题。"
        "如果上下文不足，请明确说明缺少哪些信息，并给出可执行的下一步。"
        "回答尽量简洁、结构化。"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"项目ID：{project_id}\n"
                f"问题：{question}\n"
                + (f"补充上下文：\n{context}\n" if context else "")
            ),
        },
    ]

    try:
        answer = _dashscope_chat(messages)
        return jsonify({"answer": answer, "related_code": None})
    except requests.HTTPError as e:
        resp = getattr(e, "response", None)
        upstream_status = getattr(resp, "status_code", None)
        payload = _extract_http_error_payload(resp)
        upstream_code = None
        upstream_message = None
        if isinstance(payload, dict):
            err = payload.get("error")
            if isinstance(err, dict):
                upstream_code = err.get("code")
                upstream_message = err.get("message")

        status_to_return = upstream_status if isinstance(upstream_status, int) else 502
        if isinstance(upstream_status, int) and upstream_status >= 500:
            status_to_return = 502

        return jsonify({
            "error": "dashscope_http_error",
            "message": str(e),
            "status_code": upstream_status,
            "upstream_error_code": upstream_code,
            "upstream_error_message": upstream_message,
            "payload": payload,
        }), status_to_return
    except Exception as e:
        return jsonify({"error": "dashscope_error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)
