import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Sparkles } from 'lucide-react'

type Citation = {
  chunk_id: string
  file_path: string
  start_line: number
  end_line: number
  score: number
}

type PlanResp = {
  success: boolean
  data?: {
    plan_json?: string
    plan_text?: string
    reasoning?: string
    citations?: Citation[]
    evidence?: string
  }
  error?: string
}

export default function PlanPage() {
  const { id } = useParams<{ id: string }>()
  const [requirement, setRequirement] = useState('')
  const [constraints, setConstraints] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planText, setPlanText] = useState<string>('')
  const [planJson, setPlanJson] = useState<string>('')
  const [reasoning, setReasoning] = useState<string>('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [evidence, setEvidence] = useState<string>('')

  const canSubmit = useMemo(() => {
    return Boolean(id && requirement.trim() && !loading)
  }, [id, requirement, loading])

  const generate = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setPlanText('')
    setPlanJson('')
    setReasoning('')
    setCitations([])
    setEvidence('')
    try {
      const res = await axios.post<PlanResp>('/api/assist/plan', {
        project_id: id,
        requirement,
        constraints: constraints.trim() ? constraints : null,
        thinking,
      })
      if (!res.data?.success) {
        setError(res.data?.error || '生成计划失败')
        return
      }
      const data = res.data.data || {}
      setPlanText(data.plan_text || '')
      setPlanJson(data.plan_json || '')
      setReasoning(data.reasoning || '')
      setCitations(data.citations || [])
      setEvidence(data.evidence || '')
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '生成计划失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            返回项目列表
          </Link>
          <div>
            <div className="text-2xl font-bold text-gray-900">一键生成改动计划</div>
            <div className="text-gray-500 text-sm">
              Project ID：{id || '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="text-sm font-medium text-gray-700">需求描述</div>
        <textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          rows={4}
          placeholder="例如：给 Projects 页面增加一个“一键重新解析”按钮，并在任务中心可追踪状态。"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="text-sm font-medium text-gray-700">约束（可选）</div>
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={3}
          placeholder="例如：不改数据库结构；尽量少改动现有文件；必须补充验证步骤。"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={thinking}
              onChange={(e) => setThinking(e.target.checked)}
              disabled={loading}
              className="h-4 w-4"
            />
            思考模式（可能返回推理过程）
          </label>
          <button
            onClick={generate}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? '生成中...' : '生成计划'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {(planText || planJson || reasoning || citations.length > 0 || evidence) && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-gray-900">生成结果</div>
          <div className="p-4 space-y-4">
            {planText && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Plan（文本）</div>
                <pre className="p-3 bg-gray-50 border rounded-lg text-xs overflow-auto max-h-[420px] whitespace-pre-wrap">
                  {planText}
                </pre>
              </div>
            )}

            {planJson && (
              <details className="space-y-2">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Plan JSON（点击展开）
                </summary>
                <pre className="p-3 bg-gray-50 border rounded-lg text-xs overflow-auto max-h-[420px] whitespace-pre-wrap">
                  {planJson}
                </pre>
              </details>
            )}

            {reasoning && (
              <details className="space-y-2">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  推理过程（点击展开）
                </summary>
                <pre className="p-3 bg-gray-50 border rounded-lg text-xs overflow-auto max-h-[420px] whitespace-pre-wrap">
                  {reasoning}
                </pre>
              </details>
            )}

            {citations.length > 0 && (
              <details className="space-y-2">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  证据引用（点击展开）
                </summary>
                <div className="p-3 bg-gray-50 border rounded-lg text-xs overflow-auto max-h-[320px]">
                  <div className="space-y-1">
                    {citations.map((c, idx) => (
                      <div key={c.chunk_id} className="text-gray-700">
                        [{idx + 1}] {c.file_path}:{c.start_line}-{c.end_line} (score {c.score.toFixed(4)})
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {evidence && (
              <details className="space-y-2">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  证据片段（点击展开）
                </summary>
                <pre className="p-3 bg-gray-50 border rounded-lg text-xs overflow-auto max-h-[420px] whitespace-pre-wrap">
                  {evidence}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
