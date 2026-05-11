import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  FolderCode,
  GitBranch,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  SearchCode,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

interface Project {
  id: string
  name: string
  url: string | null
  language: string | null
  status: string
  created_at?: string
  updated_at?: string
}

interface TaskRow {
  id: string
  project_id: string
  task_type: string
  status: string
  config: unknown
  result: unknown
  created_at?: string
  completed_at?: string | null
}

interface MetricCardProps {
  label: string
  value: number
  hint: string
  icon: React.ElementType
  tone: 'blue' | 'green' | 'red' | 'zinc' | 'amber'
}

const toneClass = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  zinc: 'bg-zinc-50 text-zinc-700 border-zinc-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
}

const statusText: Record<string, string> = {
  imported: '已导入',
  parsing: '解析中',
  indexed: '已索引',
  completed: '已完成',
  failed: '失败',
  pending: '等待中',
  running: '运行中',
}

function badgeClass(status: string) {
  if (status === 'completed' || status === 'indexed') return 'bg-emerald-100 text-emerald-800'
  if (status === 'failed') return 'bg-red-100 text-red-800'
  if (status === 'running' || status === 'parsing') return 'bg-blue-100 text-blue-800'
  return 'bg-amber-100 text-amber-800'
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function getTaskProjectName(projects: Project[], projectId: string) {
  return projects.find((project) => project.id === projectId)?.name || projectId
}

function MetricCard({ label, value, hint, icon: Icon, tone }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal text-zinc-900">{value}</p>
        </div>
        <div className={`rounded-lg border p-3 ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-500">{hint}</p>
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {action}
    </div>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectRes, taskRes] = await Promise.all([
        axios.get('/api/projects'),
        axios.get('/api/tasks', { params: { limit: 100 } }),
      ])

      if (!projectRes.data?.success) {
        throw new Error(projectRes.data?.error || '项目数据加载失败')
      }
      if (!taskRes.data?.success) {
        throw new Error(taskRes.data?.error || '任务数据加载失败')
      }

      setProjects(projectRes.data.data ?? [])
      setTasks(taskRes.data.data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '仪表盘数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const summary = useMemo(() => {
    const taskCounts = tasks.reduce<Record<string, number>>(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
      },
      { pending: 0, running: 0, completed: 0, failed: 0 },
    )

    const completedProjects = projects.filter((project) =>
      ['completed', 'indexed'].includes(project.status),
    ).length

    return {
      projectCount: projects.length,
      completedProjects,
      runningTasks: taskCounts.running || 0,
      failedTasks: taskCounts.failed || 0,
      taskCounts,
    }
  }, [projects, tasks])

  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        const left = new Date(a.updated_at || a.created_at || 0).getTime()
        const right = new Date(b.updated_at || b.created_at || 0).getTime()
        return right - left
      })
      .slice(0, 5)
  }, [projects])

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const left = new Date(a.created_at || 0).getTime()
        const right = new Date(b.created_at || 0).getTime()
        return right - left
      })
      .slice(0, 5)
  }, [tasks])

  const alerts = useMemo(() => {
    const failed = tasks
      .filter((task) => task.status === 'failed')
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: `${task.task_type || '任务'} 执行失败`,
        detail: getTaskProjectName(projects, task.project_id),
        to: `/tasks?status=failed`,
      }))

    if (failed.length > 0) return failed

    return projects
      .filter((project) => !['completed', 'indexed'].includes(project.status))
      .slice(0, 3)
      .map((project) => ({
        id: project.id,
        title: '项目尚未完成解析或索引',
        detail: project.name,
        to: `/projects/${project.id}/dependencies`,
      }))
  }, [projects, tasks])

  const latestProject = recentProjects[0]
  const taskStatusRows = ['pending', 'running', 'completed', 'failed']
  const maxTaskCount = Math.max(...taskStatusRows.map((status) => summary.taskCounts[status] || 0), 1)

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
        正在加载仪表盘数据...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">系统工作台</h1>
          <p className="mt-1 text-sm text-zinc-500">集中查看项目解析、索引任务和下一步工作入口。</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="项目总数"
          value={summary.projectCount}
          hint="已导入到系统的代码仓库"
          icon={FolderCode}
          tone="zinc"
        />
        <MetricCard
          label="已完成项目"
          value={summary.completedProjects}
          hint="状态为 completed 或 indexed"
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          label="运行中任务"
          value={summary.runningTasks}
          hint="正在解析、索引或执行的任务"
          icon={Clock3}
          tone="blue"
        />
        <MetricCard
          label="失败任务"
          value={summary.failedTasks}
          hint="需要优先检查的异常任务"
          icon={ShieldAlert}
          tone={summary.failedTasks > 0 ? 'red' : 'zinc'}
        />
      </div>

      {summary.projectCount === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-10">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex rounded-lg bg-blue-50 p-3 text-blue-700">
              <Plus className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">开始理解你的第一个代码仓库</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              导入本地路径或 Git 仓库后，可以生成依赖图、建立代码索引，并使用 Copilot 进行代码问答与计划生成。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/projects"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                导入项目
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/tasks"
                className="inline-flex items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                查看任务中心
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="rounded-lg border border-zinc-200 bg-white xl:col-span-2">
              <SectionHeader title="当前工作流快捷入口" />
              <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-5">
                {[
                  { label: '导入项目', icon: Plus, to: '/projects', done: projects.length > 0 },
                  { label: '解析结构', icon: GitBranch, to: latestProject ? `/projects/${latestProject.id}/dependencies` : '/projects', done: recentProjects.some((project) => ['completed', 'indexed'].includes(project.status)) },
                  { label: '构建索引', icon: SearchCode, to: latestProject ? `/projects/${latestProject.id}/dependencies` : '/projects', done: recentProjects.some((project) => project.status === 'indexed') },
                  { label: '代码问答', icon: Bot, to: latestProject ? `/projects/${latestProject.id}/copilot?mode=code` : '/projects', done: tasks.some((task) => task.task_type === 'index' && task.status === 'completed') },
                  { label: '生成计划', icon: Sparkles, to: latestProject ? `/projects/${latestProject.id}/copilot?mode=plan` : '/projects', done: false },
                ].map((step, index) => {
                  const Icon = step.icon
                  return (
                    <Link
                      key={step.label}
                      to={step.to}
                      className="group rounded-lg border border-zinc-200 p-4 hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="rounded-lg bg-zinc-100 p-2 text-zinc-600 group-hover:bg-white group-hover:text-blue-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          {step.done ? '已完成' : `步骤 ${index + 1}`}
                        </span>
                      </div>
                      <div className="mt-4 text-sm font-medium text-zinc-900">{step.label}</div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white">
              <SectionHeader
                title="任务状态分布"
                action={
                  <Link to="/tasks" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    任务中心
                  </Link>
                }
              />
              <div className="space-y-4 p-5">
                {taskStatusRows.map((status) => {
                  const count = summary.taskCounts[status] || 0
                  const width = `${Math.max((count / maxTaskCount) * 100, count > 0 ? 8 : 0)}%`
                  return (
                    <Link key={status} to={`/tasks?status=${status}`} className="block">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700">{statusText[status] || status}</span>
                        <span className="text-zinc-500">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div className={`h-2 rounded-full ${status === 'failed' ? 'bg-red-500' : status === 'completed' ? 'bg-emerald-500' : status === 'running' ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <SectionHeader
              title="最近项目"
              action={
                <Link to="/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  查看全部
                </Link>
              }
            />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">项目名称</th>
                    <th className="px-5 py-3 text-left font-medium">语言</th>
                    <th className="px-5 py-3 text-left font-medium">状态</th>
                    <th className="px-5 py-3 text-left font-medium">更新时间</th>
                    <th className="px-5 py-3 text-right font-medium">快捷操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recentProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-4">
                        <div className="font-medium text-zinc-900">{project.name}</div>
                        <div className="mt-1 max-w-md truncate text-xs text-zinc-500">{project.url || project.id}</div>
                      </td>
                      <td className="px-5 py-4 text-zinc-600">{project.language || '-'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(project.status)}`}>
                          {statusText[project.status] || project.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-600">{formatTime(project.updated_at || project.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link to={`/projects/${project.id}/dependencies`} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                            Graph
                          </Link>
                          <Link to={`/projects/${project.id}/copilot?mode=code`} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                            Copilot
                          </Link>
                          <Link to={`/tasks?project_id=${project.id}`} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                            Task
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-zinc-200 bg-white">
              <SectionHeader
                title="异常提醒与待处理事项"
                action={
                  summary.failedTasks > 0 ? (
                    <Link to="/tasks?status=failed" className="text-sm font-medium text-red-600 hover:text-red-700">
                      查看失败任务
                    </Link>
                  ) : null
                }
              />
              <div className="divide-y divide-zinc-100">
                {alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <Link key={alert.id} to={alert.to} className="flex items-start gap-3 px-5 py-4 hover:bg-zinc-50">
                      <AlertTriangle className={`mt-0.5 h-5 w-5 ${summary.failedTasks > 0 ? 'text-red-600' : 'text-amber-600'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-zinc-900">{alert.title}</div>
                        <div className="mt-1 truncate text-sm text-zinc-500">{alert.detail}</div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-zinc-400" />
                    </Link>
                  ))
                ) : (
                  <div className="px-5 py-8 text-sm text-zinc-500">暂无需要处理的异常。</div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white">
              <SectionHeader title="最近任务与 Copilot 入口" />
              <div className="divide-y divide-zinc-100">
                {recentTasks.length > 0 ? (
                  recentTasks.map((task) => (
                    <Link key={task.id} to={`/tasks?project_id=${task.project_id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-50">
                      <CircleDot className="h-4 w-4 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-zinc-900">
                          {task.task_type || '任务'} · {getTaskProjectName(projects, task.project_id)}
                        </div>
                        <div className="mt-1 text-sm text-zinc-500">{formatTime(task.created_at)}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(task.status)}`}>
                        {statusText[task.status] || task.status}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="px-5 py-8 text-sm text-zinc-500">暂无任务记录。</div>
                )}
                {latestProject && (
                  <Link to={`/projects/${latestProject.id}/copilot?mode=code`} className="flex items-center gap-3 px-5 py-4 hover:bg-indigo-50/60">
                    <MessageSquareText className="h-5 w-5 text-indigo-600" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-900">继续使用 Copilot</div>
                      <div className="mt-1 truncate text-sm text-zinc-500">{latestProject.name}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                  </Link>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
