import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Bot, Plus, Send, User, FileText, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'

type Mode = 'code' | 'plan'

type Citation = {
  chunk_id: string
  file_path: string
  start_line: number
  end_line: number
  score: number
}

type CopilotResp = {
  success: boolean
  data?: {
    session_id?: string
    mode?: string
    answer?: string
    reasoning?: string
    plan_json?: string
    plan_text?: string
    citations?: Citation[]
    evidence?: string
  }
  error?: string
}

type Msg = {
  id: string
  role: 'user' | 'assistant'
  mode: Mode
  content: string
  reasoning?: string
  citations?: Citation[]
  evidence?: string
  created_at?: string
}

type SessionItem = {
  id: string
  project_id: string
  title?: string
  last_mode?: string
  updated_at?: string
}

type ApiListResp<T> = { success: boolean; data?: T; error?: string }

const initMessage: Msg = {
  id: 'init',
  role: 'assistant',
  mode: 'code',
  content: '你好，我是 Copilot。你可以在 code / plan 之间切换，我会在左侧保存会话历史。',
}

function ModeToggle({ mode, onChange, disabled }: { mode: Mode; onChange: (m: Mode) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-lg border bg-white p-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('code')}
        className={`px-3 py-1.5 text-sm rounded-md ${
          mode === 'code' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
        } disabled:opacity-50`}
      >
        code
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('plan')}
        className={`px-3 py-1.5 text-sm rounded-md ${
          mode === 'plan' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
        } disabled:opacity-50`}
      >
        plan
      </button>
    </div>
  )
}

function parseSseEvents(chunk: string) {
  const events: Array<{ event: string; data: string }> = []
  const blocks = chunk.split('\n\n').filter(Boolean)
  for (const b of blocks) {
    const lines = b.split('\n').filter(Boolean)
    let eventName = 'message'
    const dataLines: string[] = []
    for (const l of lines) {
      if (l.startsWith('event:')) eventName = l.slice(6).trim()
      if (l.startsWith('data:')) dataLines.push(l.slice(5).trim())
    }
    events.push({ event: eventName, data: dataLines.join('\n') })
  }
  return events
}

export default function CopilotPage() {
  const { id } = useParams<{ id: string }>()

  const [mode, setMode] = useState<Mode>('code')
  const [messages, setMessages] = useState<Msg[]>([initMessage])
  const [sessionId, setSessionId] = useState<string>('')
  const didRestoreSessionRef = useRef(false)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [input, setInput] = useState('')
  const [constraints, setConstraints] = useState('')
  const [thinking, setThinking] = useState(false)
  const [topK, setTopK] = useState(8)
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshSessions = async () => {
    if (!id) return
    try {
      const res = await axios.get<ApiListResp<SessionItem[]>>('/api/copilot/sessions', { params: { project_id: id } })
      if (res.data?.success) setSessions(res.data.data || [])
    } catch {
    }
  }

  useEffect(() => {
    if (!id) return
    if (didRestoreSessionRef.current) return
    didRestoreSessionRef.current = true
    const key = `copilot:lastSession:${id}`
    const stored = window.localStorage.getItem(key)
    if (stored) setSessionId(stored)
  }, [id])

  useEffect(() => {
    if (!id) return
    const key = `copilot:lastSession:${id}`
    if (sessionId) window.localStorage.setItem(key, sessionId)
    else window.localStorage.removeItem(key)
  }, [id, sessionId])

  useEffect(() => {
    refreshSessions()
  }, [id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, loadingHistory])

  useEffect(() => {
    const load = async () => {
      if (!sessionId) {
        setMessages([initMessage])
        return
      }
      setLoadingHistory(true)
      setMessages([initMessage])
      try {
        const res = await axios.get<ApiListResp<any[]>>('/api/copilot/messages', {
          params: { session_id: sessionId, limit: 200 },
        })
        if (!res.data?.success) throw new Error(res.data?.error || '加载失败')
        const rows = res.data.data || []
        setMessages(
          rows.map((r) => ({
            id: r.id,
            role: r.role,
            mode: (r.mode === 'plan' ? 'plan' : 'code') as Mode,
            content: r.content || '',
            reasoning: r.reasoning || undefined,
            citations: r.citations || [],
            created_at: r.created_at,
          }))
        )
      } catch (e: any) {
        setMessages([
          initMessage,
          { id: `hist-err-${Date.now()}`, role: 'assistant', mode: 'code', content: `历史记录加载失败：${e?.message || ''}` },
        ])
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [sessionId])

  const canSend = useMemo(() => {
    return Boolean(id && input.trim() && !loading && !loadingHistory)
  }, [id, input, loading, loadingHistory])

  const startNewSession = () => {
    if (!id) return
    const key = `copilot:lastSession:${id}`
    window.localStorage.removeItem(key)
    setSessionId('')
    setMessages([initMessage])
  }

  const selectSession = (s: SessionItem) => {
    setSessionId(s.id)
    const m = (s.last_mode || '').toLowerCase()
    if (m === 'plan') setMode('plan')
    else setMode('code')
  }

  const appendToAssistant = (assistantId: string, patch: Partial<Msg> & { appendContent?: string; appendReasoning?: string }) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m
        return {
          ...m,
          ...patch,
          content: patch.appendContent ? (m.content || '') + patch.appendContent : patch.content ?? m.content,
          reasoning: patch.appendReasoning ? (m.reasoning || '') + patch.appendReasoning : patch.reasoning ?? m.reasoning,
        }
      })
    )
  }

  const send = async () => {
    if (!canSend) return
    const q = input.trim()
    setInput('')

    const userId = `u-${Date.now()}`
    const assistantId = `a-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', mode, content: q },
      { id: assistantId, role: 'assistant', mode, content: '' },
    ])

    setLoading(true)

    const payload = {
      project_id: id,
      session_id: sessionId || null,
      mode,
      message: q,
      constraints: mode === 'plan' && constraints.trim() ? constraints : null,
      thinking,
      top_k: topK,
    }

    try {
      const res = await fetch('/api/copilot/message/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok || !res.body) {
        throw new Error(await res.text())
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const p of parts) {
          const evs = parseSseEvents(p + '\n\n')
          for (const ev of evs) {
            if (!ev.data) continue
            if (ev.event === 'meta') {
              const meta = JSON.parse(ev.data)
              if (meta.session_id) setSessionId(meta.session_id)
              if (meta.citations || meta.evidence) {
                appendToAssistant(assistantId, { citations: meta.citations || [], evidence: meta.evidence })
              }
            } else if (ev.event === 'delta') {
              const d = JSON.parse(ev.data)
              if (d.content_delta) appendToAssistant(assistantId, { appendContent: d.content_delta })
              if (d.reasoning_delta) appendToAssistant(assistantId, { appendReasoning: d.reasoning_delta })
            } else if (ev.event === 'done') {
              const doneData = JSON.parse(ev.data)
              if (doneData.session_id) setSessionId(doneData.session_id)
              const answer = doneData.plan_text || doneData.answer || ''
              appendToAssistant(assistantId, {
                content: answer,
                reasoning: doneData.reasoning || undefined,
                citations: doneData.citations || [],
                evidence: doneData.evidence,
              })
              refreshSessions()
            } else if (ev.event === 'error') {
              const err = JSON.parse(ev.data)
              appendToAssistant(assistantId, { content: `请求失败：${err?.error || ''}` })
            }
          }
        }
      }
    } catch (e: any) {
      try {
        const res = await axios.post<CopilotResp>('/api/copilot/message', payload)
        if (!res.data?.success) throw new Error(res.data?.error || '请求失败')
        const data = res.data.data || {}
        if (data.session_id) setSessionId(data.session_id)
        const answer = data.plan_text || data.answer || '未返回回答'
        appendToAssistant(assistantId, {
          content: answer,
          reasoning: data.reasoning,
          citations: data.citations || [],
          evidence: data.evidence,
        })
        refreshSessions()
      } catch (e2: any) {
        appendToAssistant(assistantId, { content: `请求失败：${e2?.message || e?.message || ''}` })
      }
    } finally {
      setLoading(false)
    }
  }

  const renderMarkdown = (text: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-6">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-6">{children}</li>,
          code: ({ children }) => <code className="px-1 py-0.5 rounded bg-gray-100 text-[0.9em]">{children}</code>,
          pre: ({ children }) => <pre className="p-3 rounded-lg bg-gray-100 overflow-auto text-sm">{children}</pre>,
          a: ({ children, href }) => (
            <a className="text-blue-600 hover:underline" href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    )
  }

  const renderPlan = (content: string) => {
    try {
      // 尝试解析 JSON。模型输出有时可能带 markdown 代码块，需要清理
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
      }
      
      const plan = JSON.parse(jsonStr);
      if (!plan.title || (!plan.steps && !plan.files_to_change)) {
        return renderMarkdown(content);
      }

      return (
        <div className="not-prose space-y-6 text-gray-900">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold">{plan.title}</h3>
          </div>

          {plan.assumptions?.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">前提假设</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {plan.assumptions.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </section>
          )}

          {plan.files_to_change?.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">待改动文件</h4>
              <div className="grid gap-2">
                {plan.files_to_change.map((f: any, i: number) => (
                  <div key={i} className="group p-3 border rounded-xl bg-gray-50 hover:bg-white hover:shadow-sm transition-all flex items-start gap-3">
                    <span className={`flex-shrink-0 mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                      f.change_type === 'add' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {f.change_type === 'add' ? '新增' : '修改'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono font-medium text-gray-900 truncate flex items-center gap-1">
                        {f.path}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{f.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {plan.api_changes?.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">API 变动</h4>
              <div className="border rounded-xl overflow-hidden">
                {plan.api_changes.map((api: any, i: number) => (
                  <div key={i} className="px-3 py-2 border-b last:border-0 bg-white flex items-center gap-3">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 w-12 text-center">
                      {api.method}
                    </span>
                    <code className="text-xs font-mono text-gray-600 flex-1">{api.path}</code>
                    <span className="text-xs text-gray-500">{api.summary}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {plan.steps?.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">实施步骤</h4>
              <div className="space-y-4">
                {plan.steps.map((s: any, i: number) => (
                  <div key={i} className="relative flex gap-4 pl-2">
                    {i !== plan.steps.length - 1 && (
                      <div className="absolute left-[15px] top-6 bottom-[-16px] w-px bg-gray-200" />
                    )}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white border-2 border-gray-900 text-gray-900 flex items-center justify-center text-xs font-bold z-10 shadow-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="text-sm font-bold text-gray-900">{s.description}</div>
                      <div className="text-xs text-gray-600 mt-1 leading-relaxed">{s.details}</div>
                      {s.validation?.length > 0 && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-100 space-y-1">
                          {s.validation.map((v: string, j: number) => (
                            <div key={j} className="text-[11px] flex items-center gap-1.5 text-green-700">
                              <CheckCircle2 className="w-3 h-3" /> {v}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {plan.risks?.length > 0 && (
            <section className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> 潜在风险与注意事项
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-xs text-amber-700 leading-relaxed">
                {plan.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </section>
          )}
        </div>
      );
    } catch (e) {
      return renderMarkdown(content);
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50 -m-8 overflow-hidden">
      <aside className="w-72 border-r bg-white flex flex-col flex-shrink-0">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <Link to="/projects" className="inline-flex items-center gap-2 px-2.5 py-2 rounded-lg border hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <button
            type="button"
            onClick={startNewSession}
            disabled={loading || loadingHistory}
            className="inline-flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            新会话
          </button>
        </div>

        <div className="p-3 border-b">
          <div className="text-sm font-semibold text-gray-900">会话</div>
          <div className="text-xs text-gray-500">Project：{id || '—'}</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={startNewSession}
            className={`w-full text-left px-3 py-3 border-b hover:bg-gray-50 ${
              !sessionId ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            <div className="text-sm font-medium text-gray-900">新会话</div>
            <div className="text-xs text-gray-500">从这里开始新的对话</div>
          </button>

          {sessions.map((s) => {
            const active = s.id === sessionId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSession(s)}
                className={`w-full text-left px-3 py-3 border-b hover:bg-gray-50 ${active ? 'bg-gray-50' : 'bg-white'}`}
              >
                <div className="text-sm font-medium text-gray-900 truncate">{s.title || s.id}</div>
                <div className="text-xs text-gray-500 truncate">
                  {(s.last_mode || 'code').toUpperCase()} · {s.updated_at || ''}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b bg-white flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900">Copilot</div>
            <div className="text-xs text-gray-500 truncate">{sessionId ? `Session: ${sessionId}` : 'Session: new'}</div>
          </div>

          <div className="flex items-center gap-3">
            <ModeToggle mode={mode} onChange={setMode} disabled={loading || loadingHistory} />
            <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={thinking}
                onChange={(e) => setThinking(e.target.checked)}
                disabled={loading || loadingHistory}
                className="h-4 w-4"
              />
              思考
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              TopK
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(20, Number(e.target.value) || 8)))}
                disabled={loading || loadingHistory}
                className="w-16 px-2 py-1 border rounded"
              />
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl p-4 ${
                      m.role === 'user' ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white border text-gray-900 rounded-tl-none shadow-sm'
                    }`}
                  >
                    <div className="flex items-center mb-2 text-xs text-gray-500">
                      {m.role === 'user' ? <User className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
                      {m.role} · {m.mode}
                    </div>

                    {m.role === 'assistant' ? (
                      <div className="text-sm prose prose-zinc max-w-none prose-sm">
                        {m.mode === 'plan' ? renderPlan(m.content || '') : renderMarkdown(m.content || '')}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-6">{m.content}</div>
                    )}

                    {m.reasoning && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer select-none hover:text-gray-700 transition-colors">推理过程</summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded-lg text-xs whitespace-pre-wrap border border-gray-200">{m.reasoning}</pre>
                      </details>
                    )}

                    {m.citations && m.citations.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer select-none hover:text-gray-700 transition-colors">证据引用（{m.citations.length}）</summary>
                        <div className="mt-2 p-2 bg-gray-100 rounded-lg text-xs space-y-1 border border-gray-200">
                          {m.citations.map((c, idx) => (
                            <div key={`${m.id}-${c.chunk_id}`} className="truncate">
                              [{idx + 1}] {c.file_path}:{c.start_line}-{c.end_line} (score {c.score.toFixed(4)})
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {m.evidence && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer select-none hover:text-gray-700 transition-colors">证据片段</summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded-lg text-xs whitespace-pre-wrap max-h-72 overflow-auto border border-gray-200">{m.evidence}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border shadow-sm rounded-2xl rounded-tl-none p-4 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-900 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-900 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-gray-900 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border-t flex-shrink-0">
          <div className="max-w-4xl mx-auto w-full p-4">
            {mode === 'plan' && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1">约束（可选）</div>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  rows={2}
                  placeholder="例如：不改数据库结构；只允许新增文件；必须给出验证步骤。"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={mode === 'plan' ? '描述你要做的改动需求...' : '输入你的问题...'}
                disabled={loading || loadingHistory}
                className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="p-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
