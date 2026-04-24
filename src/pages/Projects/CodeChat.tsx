import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Bot, Info, Send, User } from 'lucide-react'

type Citation = {
  chunk_id: string
  file_path: string
  start_line: number
  end_line: number
  score: number
}

type CodeChatResp = {
  success: boolean
  data?: {
    answer?: string
    reasoning?: string
    citations?: Citation[]
  }
  error?: string
}

type Msg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  citations?: Citation[]
}

export default function CodeChatPage() {
  const { id } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'init',
      role: 'assistant',
      content:
        '你好，我是“与代码对话”助手。我会先从向量库检索相关代码片段，再基于证据回答。你可以问：某个模块做什么、某个接口在哪实现、某段逻辑如何修改。',
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [topK, setTopK] = useState(8)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const canSend = useMemo(() => {
    return Boolean(id && input.trim() && !loading)
  }, [id, input, loading])

  const send = async () => {
    if (!canSend) return

    const q = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        content: q,
      },
    ])
    setLoading(true)

    try {
      const res = await axios.post<CodeChatResp>('/api/code/chat', {
        project_id: id,
        question: q,
        thinking,
        top_k: topK,
      })
      const data = res.data?.data || {}
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer || '未返回回答',
          reasoning: data.reasoning,
          citations: data.citations || [],
        },
      ])
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || '请求失败'
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `请求失败：${msg}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <div>
            <div className="text-xl font-bold text-gray-900">与代码对话</div>
            <div className="text-xs text-gray-500">Project ID：{id || '—'}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={thinking}
              onChange={(e) => setThinking(e.target.checked)}
              disabled={loading}
              className="h-4 w-4"
            />
            思考模式
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            TopK
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              disabled={loading}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v)) setTopK(Math.max(1, Math.min(20, v)))
              }}
              className="w-16 px-2 py-1 border rounded"
            />
          </label>
          <div className="text-sm text-gray-500 flex items-center">
            <Info className="w-4 h-4 mr-1" />
            RAG + DeepSeek
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[84%] rounded-2xl p-4 ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border text-gray-800 rounded-tl-none'
              }`}
            >
              <div className="flex items-center mb-1 text-xs opacity-75">
                {m.role === 'user' ? (
                  <User className="w-3 h-3 mr-1" />
                ) : (
                  <Bot className="w-3 h-3 mr-1" />
                )}
                {m.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>

              {m.reasoning && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer select-none">
                    推理过程（点击展开）
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded-lg text-xs whitespace-pre-wrap">
                    {m.reasoning}
                  </pre>
                </details>
              )}

              {m.citations && m.citations.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer select-none">
                    证据引用（{m.citations.length}）
                  </summary>
                  <div className="mt-2 p-2 bg-gray-100 rounded-lg text-xs space-y-1">
                    {m.citations.map((c, idx) => (
                      <div key={`${m.id}-${c.chunk_id}`}>
                        [{idx + 1}] {c.file_path}:{c.start_line}-{c.end_line} (score {c.score.toFixed(4)})
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-2xl rounded-tl-none p-4 flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && send()}
            placeholder="例如：项目里负责项目导入的后端逻辑在哪？"
            className="flex-grow p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={send}
            disabled={!canSend}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

