import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { RefreshCw, Search, X } from 'lucide-react'

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | string

interface TaskRow {
  id: string
  project_id: string
  task_type: string
  status: TaskStatus
  config: any
  result: any
  created_at?: string
  completed_at?: string | null
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function badgeClass(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-800'
  if (status === 'failed') return 'bg-red-100 text-red-800'
  if (status === 'running') return 'bg-blue-100 text-blue-800'
  return 'bg-yellow-100 text-yellow-800'
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('')
  const [taskType, setTaskType] = useState<string>('')
  const [selected, setSelected] = useState<TaskRow | null>(null)

  const fetchTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = { limit: 100 }
      if (status) params.status = status
      if (taskType) params.task_type = taskType
      const res = await axios.get('/api/tasks', { params })
      if (res.data?.success) {
        setTasks(res.data.data ?? [])
      } else {
        setError(res.data?.error || 'Failed to load tasks')
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => {
      const hay = `${t.id} ${t.project_id} ${t.task_type} ${t.status}`.toLowerCase()
      return hay.includes(q)
    })
  }, [tasks, query])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务中心</h1>
          <p className="text-gray-500">查看解析任务与执行结果</p>
        </div>
        <button
          onClick={fetchTasks}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 task_id / project_id / type / status"
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部状态</option>
            <option value="pending">pending</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部类型</option>
            <option value="parse">parse</option>
          </select>
          <button
            onClick={fetchTasks}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            应用筛选
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Task ID</th>
                  <th className="text-left px-4 py-3 font-medium">Project ID</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-left px-4 py-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(t)}
                  >
                    <td className="px-4 py-3 text-gray-900">{t.id}</td>
                    <td className="px-4 py-3 text-gray-600">{t.project_id}</td>
                    <td className="px-4 py-3 text-gray-600">{t.task_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(t.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(t.completed_at || undefined)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-gray-500" colSpan={6}>
                      暂无任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl border shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="font-bold text-gray-900">任务详情</div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="text-gray-700"><span className="font-medium">Task ID：</span>{selected.id}</div>
                <div className="text-gray-700"><span className="font-medium">Project ID：</span>{selected.project_id}</div>
                <div className="text-gray-700"><span className="font-medium">Type：</span>{selected.task_type}</div>
                <div className="text-gray-700">
                  <span className="font-medium">Status：</span>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="text-gray-700"><span className="font-medium">Created：</span>{formatTime(selected.created_at)}</div>
                <div className="text-gray-700"><span className="font-medium">Completed：</span>{formatTime(selected.completed_at || undefined)}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">Config</div>
                  <pre className="p-3 text-xs overflow-auto max-h-64">{JSON.stringify(selected.config, null, 2)}</pre>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">Result</div>
                  <pre className="p-3 text-xs overflow-auto max-h-64">{JSON.stringify(selected.result, null, 2)}</pre>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
