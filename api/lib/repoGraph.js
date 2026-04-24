import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import * as ts from 'typescript'

const DEFAULT_IGNORE_DIRS = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  'target',
  '.venv',
  'venv',
  '__pycache__',
])

const DEFAULT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.java'])

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function isSubPath(parent, child) {
  const rel = path.relative(parent, child)
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function walkFiles(rootDir, opts) {
  const ignoreDirs = opts?.ignoreDirs || DEFAULT_IGNORE_DIRS
  const exts = opts?.extensions || DEFAULT_EXTS
  const maxFiles = opts?.maxFiles || 4000

  const result = []
  const stack = [rootDir]

  while (stack.length) {
    const dir = stack.pop()
    if (!dir) break

    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const ent of entries) {
      const abs = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ignoreDirs.has(ent.name)) continue
        stack.push(abs)
        continue
      }
      if (!ent.isFile()) continue
      const ext = path.extname(ent.name).toLowerCase()
      if (!exts.has(ext)) continue
      result.push(abs)
      if (result.length >= maxFiles) return result
    }
  }

  return result
}

function parseJavaImports(code) {
  const imports = []
  const lines = code.split(/\r?\n/)
  const re = /^\s*import\s+([a-zA-Z0-9_\.]+)\s*;\s*$/
  for (const line of lines) {
    const m = line.match(re)
    if (m?.[1]) imports.push(m[1])
  }
  return imports
}

function tsScriptKindForExt(ext) {
  if (ext === '.ts') return ts.ScriptKind.TS
  if (ext === '.tsx') return ts.ScriptKind.TSX
  if (ext === '.jsx') return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

function parseJsTsAst(code, fileName, ext) {
  const imports = []
  const classes = []
  const functions = []

  const sf = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    tsScriptKindForExt(ext),
  )

  const addSpec = (v) => {
    if (typeof v === 'string' && v) imports.push(v)
  }

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const ms = node.moduleSpecifier
      if (ms && ts.isStringLiteralLike(ms)) addSpec(ms.text)
    }

    if (ts.isCallExpression(node)) {
      if (node.expression && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const a0 = node.arguments?.[0]
        if (a0 && ts.isStringLiteralLike(a0)) addSpec(a0.text)
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const a0 = node.arguments?.[0]
        if (a0 && ts.isStringLiteralLike(a0)) addSpec(a0.text)
      }
    }

    if (node.parent && ts.isSourceFile(node.parent)) {
      if (ts.isClassDeclaration(node) && node.name?.text) classes.push(node.name.text)
      if (ts.isFunctionDeclaration(node) && node.name?.text) functions.push(node.name.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)

  return { imports, classes, functions }
}

function resolveRelativeImport(fromAbsFile, spec, rootDir) {
  if (!(spec.startsWith('./') || spec.startsWith('../'))) return null
  const fromDir = path.dirname(fromAbsFile)
  const raw = path.resolve(fromDir, spec)

  const candidates = []
  if (path.extname(raw)) {
    candidates.push(raw)
  } else {
    candidates.push(raw + '.ts', raw + '.tsx', raw + '.js', raw + '.jsx')
    candidates.push(path.join(raw, 'index.ts'))
    candidates.push(path.join(raw, 'index.tsx'))
    candidates.push(path.join(raw, 'index.js'))
    candidates.push(path.join(raw, 'index.jsx'))
  }

  for (const c of candidates) {
    try {
      const st = fs.statSync(c)
      if (st.isFile() && isSubPath(rootDir, c)) return c
    } catch {
      continue
    }
  }
  return null
}

function toExternalId(prefix, spec) {
  return `ext:${prefix}:${spec}`
}

function loadPythonIndex(absRoot, opts) {
  const script = fileURLToPath(new URL('./pyAstIndex.py', import.meta.url))
  const maxFiles = opts?.maxFiles || 4000
  const res = spawnSync('python', [script, absRoot, String(maxFiles)], { encoding: 'utf8' })
  if (res.status !== 0) return null
  try {
    const parsed = JSON.parse(res.stdout || '{}')
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    return null
  }
  return null
}

function ensureJavaCliArtifacts() {
  const baseDir = fileURLToPath(new URL('./javaAst/', import.meta.url))
  const cacheDir = path.join(baseDir, '.cache')
  const classDir = path.join(cacheDir, 'classes')
  const jarPath = path.join(cacheDir, 'javaparser-core-3.26.1.jar')
  const javaFile = path.join(baseDir, 'JavaParserCli.java')

  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
  if (!fs.existsSync(classDir)) fs.mkdirSync(classDir, { recursive: true })

  return { baseDir, cacheDir, classDir, jarPath, javaFile }
}

function ensureJavaParserJarSync(jarPath) {
  if (fs.existsSync(jarPath)) return
  const url = 'https://repo1.maven.org/maven2/com/github/javaparser/javaparser-core/3.26.1/javaparser-core-3.26.1.jar'
  const cmd = `Invoke-WebRequest -Uri '${url}' -OutFile '${jarPath.replace(/'/g, "''")}' -UseBasicParsing`
  const res = spawnSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' })
  if (res.status !== 0 || !fs.existsSync(jarPath)) {
    throw new Error((res.stderr || res.stdout || 'Failed to download javaparser-core jar').trim())
  }
}

function ensureJavaCliCompiled(javaFile, classDir, jarPath) {
  const classFile = path.join(classDir, 'JavaParserCli.class')
  try {
    if (fs.existsSync(classFile)) {
      const srcM = fs.statSync(javaFile).mtimeMs
      const clsM = fs.statSync(classFile).mtimeMs
      if (clsM >= srcM) return
    }
  } catch {
  }
  const cp = jarPath
  const res = spawnSync('javac', ['-encoding', 'UTF-8', '-cp', cp, '-d', classDir, javaFile], { encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || 'javac failed').trim())
  }
}

function loadJavaIndex(absRoot, opts) {
  const { classDir, jarPath, javaFile } = ensureJavaCliArtifacts()
  const maxFiles = opts?.maxFiles || 4000
  try {
    ensureJavaParserJarSync(jarPath)
    ensureJavaCliCompiled(javaFile, classDir, jarPath)
    const cp = `${classDir}${path.delimiter}${jarPath}`
    const res = spawnSync('java', ['-cp', cp, 'JavaParserCli', absRoot, String(maxFiles)], { encoding: 'utf8' })
    if (res.status !== 0) return null
    const parsed = JSON.parse(res.stdout || '{}')
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    return null
  }
  return null
}

function normalizeJavaTypeName(typeName) {
  if (!typeName || typeof typeName !== 'string') return null
  let s = typeName.trim()
  if (!s) return null
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/<.*>/g, '')
  s = s.replace(/\[\]$/g, '')
  s = s.replace(/\s/g, '')
  return s || null
}

function classifyJavaRole({ packageName, name, annotations, isInterface }) {
  const pkg = String(packageName || '').toLowerCase()
  const cn = String(name || '')
  const cnLower = cn.toLowerCase()
  const anns = Array.isArray(annotations) ? annotations.map((a) => String(a)).map((a) => a.toLowerCase()) : []

  const hasAnn = (x) => anns.includes(String(x).toLowerCase())

  if (hasAnn('restcontroller') || hasAnn('controller')) return 'controller'
  if (hasAnn('service')) return cnLower.endsWith('impl') ? 'serviceImpl' : 'service'
  if (hasAnn('repository')) return 'repository'
  if (hasAnn('mapper')) return 'mapper'
  if (hasAnn('configuration')) return 'config'
  if (hasAnn('component')) return 'component'
  if (hasAnn('entity') || hasAnn('table')) return 'entity'

  if (pkg.includes('.controller') || pkg.endsWith('/controller') || cnLower.endsWith('controller')) return 'controller'
  if (pkg.includes('.service.impl') || pkg.endsWith('/service/impl') || cnLower.endsWith('serviceimpl') || cnLower.endsWith('impl')) return 'serviceImpl'
  if (pkg.includes('.service') || pkg.endsWith('/service') || cnLower.endsWith('service')) return 'service'
  if (pkg.includes('.repository') || pkg.includes('.dao') || cnLower.endsWith('repository') || cnLower.endsWith('dao')) return 'repository'
  if (pkg.includes('.mapper') || cnLower.endsWith('mapper')) return 'mapper'
  if (pkg.includes('.entity') || pkg.includes('.model') || cnLower.endsWith('entity') || cnLower.endsWith('po')) return 'entity'
  if (pkg.includes('.dto') || pkg.includes('.vo') || cnLower.endsWith('dto') || cnLower.endsWith('vo')) return 'dto'
  if (pkg.includes('.config') || cnLower.endsWith('config')) return 'config'
  if (pkg.includes('.util') || pkg.includes('.utils') || cnLower.endsWith('util') || cnLower.endsWith('utils') || cnLower.endsWith('helper')) return 'util'

  if (isInterface) {
    if (cnLower.endsWith('service')) return 'service'
    if (cnLower.endsWith('mapper')) return 'mapper'
    if (cnLower.endsWith('repository')) return 'repository'
  }

  return 'other'
}

export function buildRepoGraph(rootDir, opts) {
  const absRoot = path.resolve(rootDir)
  const files = walkFiles(absRoot, opts)

  const nodes = []
  const links = []
  const nodeIds = new Set()

  const ensureNode = (id, name, type, packageName, attrs) => {
    if (nodeIds.has(id)) return
    nodeIds.add(id)
    const n = { id, name, type }
    if (packageName) n.packageName = packageName
    if (attrs && typeof attrs === 'object') {
      for (const k of Object.keys(attrs)) n[k] = attrs[k]
    }
    nodes.push(n)
  }

  const fileIdByAbs = new Map()
  for (const abs of files) {
    const rel = toPosix(path.relative(absRoot, abs))
    const name = path.basename(abs)
    const pkg = toPosix(path.dirname(rel))
    ensureNode(rel, name, 'file', pkg === '.' ? '' : pkg)
    fileIdByAbs.set(abs, rel)
  }

  const pyIndex = loadPythonIndex(absRoot, opts)
  const javaIndex = loadJavaIndex(absRoot, opts)
  const javaClassNodeByFqn = new Map()
  const javaPackageByRel = new Map()
  const javaImportByRel = new Map()
  const javaSimpleToFqn = new Map()

  if (javaIndex && typeof javaIndex === 'object') {
    for (const rel of Object.keys(javaIndex)) {
      const info = javaIndex[rel]
      if (!info || typeof info !== 'object') continue
      const pkg = typeof info.package === 'string' ? info.package : ''
      javaPackageByRel.set(rel, pkg)
      const classes = Array.isArray(info.classes) ? info.classes : []
      const imports = Array.isArray(info.imports) ? info.imports : []
      javaImportByRel.set(rel, imports)
      for (const c of classes) {
        if (!c || typeof c !== 'object') continue
        const cn = typeof c.name === 'string' ? c.name : null
        const fqn = typeof c.fqn === 'string' ? c.fqn : null
        if (!cn || !fqn) continue
        const classId = `java:${fqn}`
        javaClassNodeByFqn.set(fqn, classId)
        const annotations = Array.isArray(c.annotations) ? c.annotations : []
        const isInterface = Boolean(c.isInterface)
        const role = classifyJavaRole({ packageName: pkg, name: cn, annotations, isInterface })
        ensureNode(classId, cn, 'class', pkg, {
          language: 'java',
          role,
          stereotypes: annotations,
          isInterface,
          fqn,
        })
        const prev = javaSimpleToFqn.get(cn) || []
        prev.push(fqn)
        javaSimpleToFqn.set(cn, prev)
        if (nodeIds.has(rel)) links.push({ source: rel, target: classId, type: 'contains' })
        const methods = Array.isArray(c.methods) ? c.methods : []
        for (const m of methods) {
          if (typeof m !== 'string' || !m) continue
          const mid = `java:${fqn}#${m}`
          ensureNode(mid, m, 'function', pkg, { language: 'java', role, owner: fqn })
          links.push({ source: classId, target: mid, type: 'contains' })
        }
      }
    }
  }

  const resolveJavaTarget = (spec, rel) => {
    const s = normalizeJavaTypeName(spec)
    if (!s) return null
    if (s.includes('.')) {
      return javaClassNodeByFqn.get(s) || toExternalId('java', s)
    }

    const pkg = javaPackageByRel.get(rel) || ''
    if (pkg) {
      const maybe = `${pkg}.${s}`
      if (javaClassNodeByFqn.has(maybe)) return javaClassNodeByFqn.get(maybe)
    }

    const imports = javaImportByRel.get(rel)
    if (Array.isArray(imports)) {
      for (const imp of imports) {
        if (!imp || typeof imp !== 'object') continue
        const ispec = normalizeJavaTypeName(imp.spec)
        if (!ispec) continue
        if (ispec.endsWith('.*')) {
          const p = ispec.slice(0, -2)
          const maybe = `${p}.${s}`
          if (javaClassNodeByFqn.has(maybe)) return javaClassNodeByFqn.get(maybe)
          continue
        }
        if (ispec.endsWith(`.${s}`) && javaClassNodeByFqn.has(ispec)) return javaClassNodeByFqn.get(ispec)
      }
    }

    const candidates = javaSimpleToFqn.get(s)
    if (Array.isArray(candidates) && candidates.length === 1) {
      return javaClassNodeByFqn.get(candidates[0]) || toExternalId('java', candidates[0])
    }

    return toExternalId('java', s)
  }

  if (javaIndex && typeof javaIndex === 'object') {
    for (const rel of Object.keys(javaIndex)) {
      const info = javaIndex[rel]
      if (!info || typeof info !== 'object') continue
      const classes = Array.isArray(info.classes) ? info.classes : []
      for (const c of classes) {
        if (!c || typeof c !== 'object') continue
        const fqn = typeof c.fqn === 'string' ? c.fqn : null
        if (!fqn) continue
        const classId = javaClassNodeByFqn.get(fqn)
        if (!classId) continue

        const exts = Array.isArray(c.extends) ? c.extends : []
        for (const e of exts) {
          const to = resolveJavaTarget(e, rel)
          if (!to) continue
          if (typeof to === 'string' && to.startsWith('ext:')) ensureNode(to, String(e), 'external', '', { language: 'java' })
          links.push({ source: classId, target: to, type: 'extends' })
        }

        const impls = Array.isArray(c.implements) ? c.implements : []
        for (const im of impls) {
          const to = resolveJavaTarget(im, rel)
          if (!to) continue
          if (typeof to === 'string' && to.startsWith('ext:')) ensureNode(to, String(im), 'external', '', { language: 'java' })
          links.push({ source: classId, target: to, type: 'implements' })
        }

        const injects = Array.isArray(c.injects) ? c.injects : []
        for (const inj of injects) {
          if (!inj || typeof inj !== 'object') continue
          const t = inj.type
          const to = resolveJavaTarget(t, rel)
          if (!to) continue
          if (typeof to === 'string' && to.startsWith('ext:')) ensureNode(to, String(t), 'external', '', { language: 'java' })
          links.push({ source: classId, target: to, type: 'injects' })
        }
      }
    }
  }

  for (const abs of files) {
    let code = ''
    try {
      code = fs.readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    const ext = path.extname(abs).toLowerCase()
    const fromId = fileIdByAbs.get(abs)
    if (!fromId) continue

    const pkg = toPosix(path.dirname(fromId))
    const pkgName = pkg === '.' ? '' : pkg

    if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx') {
      const ast = parseJsTsAst(code, abs, ext)
      for (const c of ast.classes) {
        const id = `${fromId}::class:${c}`
        ensureNode(id, c, 'class', pkgName)
        links.push({ source: fromId, target: id, type: 'contains' })
      }
      for (const f of ast.functions) {
        const id = `${fromId}::function:${f}`
        ensureNode(id, f, 'function', pkgName)
        links.push({ source: fromId, target: id, type: 'contains' })
      }
      for (const spec of ast.imports) {
        const resolved = resolveRelativeImport(abs, spec, absRoot)
        if (resolved) {
          const toId = fileIdByAbs.get(resolved)
          if (toId) links.push({ source: fromId, target: toId, type: 'import' })
          continue
        }
        const modId = toExternalId('js', spec)
        ensureNode(modId, spec, 'external', '')
        links.push({ source: fromId, target: modId, type: 'import' })
      }
      continue
    }

    if (ext === '.py' && pyIndex) {
      const rel = fromId
      const info = pyIndex[rel]
      if (info) {
        const classes = Array.isArray(info.classes) ? info.classes : []
        const functions = Array.isArray(info.functions) ? info.functions : []
        const imports = Array.isArray(info.imports) ? info.imports : []

        for (const c of classes) {
          if (typeof c !== 'string' || !c) continue
          const id = `${fromId}::class:${c}`
          ensureNode(id, c, 'class', pkgName)
          links.push({ source: fromId, target: id, type: 'contains' })
        }
        for (const f of functions) {
          if (typeof f !== 'string' || !f) continue
          const id = `${fromId}::function:${f}`
          ensureNode(id, f, 'function', pkgName)
          links.push({ source: fromId, target: id, type: 'contains' })
        }
        for (const imp of imports) {
          if (!imp || typeof imp !== 'object') continue
          const spec = imp.spec
          const resolvedRel = imp.resolved
          if (typeof resolvedRel === 'string' && resolvedRel) {
            if (nodeIds.has(resolvedRel)) links.push({ source: fromId, target: resolvedRel, type: 'import' })
            continue
          }
          if (typeof spec === 'string' && spec) {
            const modId = toExternalId('py', spec)
            ensureNode(modId, spec, 'external', '')
            links.push({ source: fromId, target: modId, type: 'import' })
          }
        }
      }
      continue
    }

    if (ext === '.java') {
      const rel = fromId
      const info = javaIndex && typeof javaIndex === 'object' ? javaIndex[rel] : null
      const imports = info && Array.isArray(info.imports) ? info.imports : null
      if (imports) {
        for (const imp of imports) {
          if (!imp || typeof imp !== 'object') continue
          const spec = imp.spec
          if (typeof spec !== 'string' || !spec) continue
          const to = resolveJavaTarget(spec, rel)
          if (!to) continue
          if (typeof to === 'string' && to.startsWith('ext:')) ensureNode(to, String(spec), 'external', '', { language: 'java' })
          links.push({ source: fromId, target: to, type: 'import' })
        }
        continue
      }

      const fallbacks = parseJavaImports(code)
      for (const spec of fallbacks) {
        const to = resolveJavaTarget(spec, rel)
        if (!to) continue
        if (typeof to === 'string' && to.startsWith('ext:')) ensureNode(to, String(spec), 'external', '', { language: 'java' })
        links.push({ source: fromId, target: to, type: 'import' })
      }
      continue
    }
  }

  return { nodes, links }
}
