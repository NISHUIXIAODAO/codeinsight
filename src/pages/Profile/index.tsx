import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Loader2,
  LogOut,
  MonitorCog,
  Moon,
  RefreshCw,
  Save,
  Server,
  Shield,
  SlidersHorizontal,
  Sun,
  Trash2,
  User,
  WandSparkles,
} from 'lucide-react'

type ProfileTab = 'basic' | 'preferences' | 'copilot' | 'privacy' | 'status' | 'security'
type ThemeMode = 'light' | 'dark' | 'system'

interface UserProfile {
  displayName: string
  email: string
  role: 'developer' | 'maintainer' | 'reviewer'
  defaultWorkspace: string
}

interface Preferences {
  defaultHome: 'dashboard' | 'projects' | 'tasks'
  themeMode: ThemeMode
  pageSize: number
  timeFormat: 'local' | 'iso'
  language: 'zh-CN' | 'en-US'
}

interface CopilotSettings {
  defaultMode: 'code' | 'plan'
  topK: number
  showReasoning: boolean
  planConstraintTemplate: string
  showCitations: boolean
}

interface HealthState {
  loading: boolean
  checkedAt: string | null
  backend: 'ok' | 'error' | 'unknown'
  storageType: string
  error: string | null
}

const PROFILE_KEY = 'codeinsight:user-profile'
const PREFERENCES_KEY = 'codeinsight:preferences'
const COPILOT_KEY = 'codeinsight:copilot-settings'

const defaultProfile: UserProfile = {
  displayName: 'CodeInsight User',
  email: 'user@codeinsight.local',
  role: 'developer',
  defaultWorkspace: 'E:\\Download_E\\Java',
}

const defaultPreferences: Preferences = {
  defaultHome: 'dashboard',
  themeMode: 'light',
  pageSize: 10,
  timeFormat: 'local',
  language: 'zh-CN',
}

const defaultCopilotSettings: CopilotSettings = {
  defaultMode: 'code',
  topK: 8,
  showReasoning: false,
  planConstraintTemplate: '',
  showCitations: true,
}

const roleLabel: Record<UserProfile['role'], string> = {
  developer: '开发者',
  maintainer: '维护者',
  reviewer: '评审者',
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

function applyTheme(mode: ThemeMode) {
  const resolved =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)
  localStorage.setItem('theme', resolved)
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-800">{label}</label>
      {hint && <p className="mt-1 text-xs leading-5 text-zinc-500">{hint}</p>}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-500 ${
        props.className || ''
      }`}
    />
  )
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
        props.className || ''
      }`}
    />
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50"
    >
      <span>
        <span className="block text-sm font-medium text-zinc-900">{label}</span>
        {hint && <span className="mt-1 block text-xs leading-5 text-zinc-500">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-blue-600' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function SegmentedButton<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: React.ElementType }>
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
      {options.map((option) => {
        const Icon = option.icon
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SettingsCard({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function ConfirmDialog({
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmText: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-lg">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfileTab>('basic')
  const [profile, setProfile] = useState<UserProfile>(() => readStorage(PROFILE_KEY, defaultProfile))
  const [preferences, setPreferences] = useState<Preferences>(() =>
    readStorage(PREFERENCES_KEY, defaultPreferences),
  )
  const [copilot, setCopilot] = useState<CopilotSettings>(() =>
    readStorage(COPILOT_KEY, defaultCopilotSettings),
  )
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    confirmText: string
    run: () => void
  } | null>(null)
  const [health, setHealth] = useState<HealthState>({
    loading: false,
    checkedAt: null,
    backend: 'unknown',
    storageType: '待检测',
    error: null,
  })
  const [maintenanceLoading, setMaintenanceLoading] = useState<string | null>(null)

  const tabs = useMemo(
    () => [
      { id: 'basic' as const, label: '基本资料', description: '账号身份与默认工作目录', icon: User },
      { id: 'preferences' as const, label: '使用偏好', description: '首页、主题、列表与时间格式', icon: SlidersHorizontal },
      { id: 'copilot' as const, label: 'Copilot 设置', description: '问答和计划生成默认参数', icon: WandSparkles },
      { id: 'privacy' as const, label: '数据与隐私', description: '本地索引、导出与清理入口', icon: Shield },
      { id: 'status' as const, label: '系统连接状态', description: '后端服务与外部依赖可用性', icon: MonitorCog },
      { id: 'security' as const, label: '安全与登录', description: '登录状态、密码和密钥入口', icon: KeyRound },
    ],
    [],
  )

  const avatarInitial = useMemo(() => {
    const source = profile.displayName.trim() || profile.email.trim() || 'U'
    return source.slice(0, 1).toUpperCase()
  }, [profile.displayName, profile.email])

  useEffect(() => {
    applyTheme(preferences.themeMode)
  }, [preferences.themeMode])

  const saveAll = (message = '设置已保存') => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    localStorage.setItem(COPILOT_KEY, JSON.stringify(copilot))
    applyTheme(preferences.themeMode)
    setSavedMessage(message)
    window.setTimeout(() => setSavedMessage(null), 2400)
  }

  const checkHealth = async () => {
    setHealth((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await axios.get('/api/health')
      const payload = res.data?.data
      setHealth({
        loading: false,
        checkedAt: new Date().toLocaleString(),
        backend: res.data?.success && payload?.status === 'ok' ? 'ok' : 'error',
        storageType: payload?.storage?.type || '待检测',
        error: null,
      })
    } catch (e: any) {
      setHealth({
        loading: false,
        checkedAt: new Date().toLocaleString(),
        backend: 'error',
        storageType: '待检测',
        error: e?.response?.data?.error || e?.message || '健康检查失败',
      })
    }
  }

  useEffect(() => {
    if (activeTab === 'status' && health.backend === 'unknown' && !health.loading) {
      checkHealth()
    }
  }, [activeTab])

  const exportSettings = async () => {
    setMaintenanceLoading('export')
    try {
      const res = await axios.get('/api/profile/export')
      if (!res.data?.success) {
        throw new Error(res.data?.error || '导出失败')
      }
      const payload = {
        local_profile: profile,
        local_preferences: preferences,
        local_copilot_settings: copilot,
        server_data: res.data.data,
        exported_at: new Date().toISOString(),
      }
      downloadJson(payload, 'codeinsight-profile-export.json')
      setSavedMessage('系统数据已导出')
      window.setTimeout(() => setSavedMessage(null), 2400)
    } catch (e: any) {
      setSavedMessage(e?.response?.data?.error || e?.message || '导出失败')
      window.setTimeout(() => setSavedMessage(null), 3200)
    } finally {
      setMaintenanceLoading(null)
    }
  }

  const downloadJson = (payload: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const runMaintenanceAction = async (
    actionKey: string,
    request: () => Promise<any>,
    buildMessage: (data: any) => string,
    after?: () => void,
  ) => {
    setMaintenanceLoading(actionKey)
    try {
      const res = await request()
      if (!res.data?.success) {
        throw new Error(res.data?.error || '操作失败')
      }
      after?.()
      setConfirmAction(null)
      setSavedMessage(buildMessage(res.data.data || {}))
      window.setTimeout(() => setSavedMessage(null), 3200)
    } catch (e: any) {
      setSavedMessage(e?.response?.data?.error || e?.message || '操作失败')
      window.setTimeout(() => setSavedMessage(null), 3600)
    } finally {
      setMaintenanceLoading(null)
    }
  }

  const logout = () => {
    localStorage.removeItem('codeinsight:session')
    localStorage.removeItem('codeinsight:auth-token')
    navigate('/login')
  }

  const renderContent = () => {
    if (activeTab === 'basic') {
      return (
        <SettingsCard
          title="基本资料"
          description="这些信息用于个人中心头像、用户标识和导入项目时的默认提示。"
          action={
            <button
              type="button"
              onClick={() => saveAll()}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              保存资料
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center rounded-lg border border-zinc-200 bg-zinc-50 p-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-700">
                {avatarInitial}
              </div>
              <div className="mt-3 text-center">
                <div className="font-semibold text-zinc-900">{profile.displayName || '未命名用户'}</div>
                <div className="mt-1 text-xs text-zinc-500">{roleLabel[profile.role]}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="昵称" hint="用于顶部头像和用户标识。" />
                <TextInput
                  value={profile.displayName}
                  onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                  placeholder="CodeInsight User"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel label="邮箱" hint="当前登录账号，MVP 阶段仅作展示。" />
                <TextInput value={profile.email} disabled />
              </div>
              <div className="space-y-2">
                <FieldLabel label="角色" hint="用于演示不同用户在论文中的角色模型。" />
                <SelectInput
                  value={profile.role}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, role: e.target.value as UserProfile['role'] }))
                  }
                >
                  <option value="developer">开发者</option>
                  <option value="maintainer">维护者</option>
                  <option value="reviewer">评审者</option>
                </SelectInput>
              </div>
              <div className="space-y-2">
                <FieldLabel label="默认工作目录" hint="导入本地项目时可作为路径提示。" />
                <TextInput
                  value={profile.defaultWorkspace}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, defaultWorkspace: e.target.value }))
                  }
                  placeholder="E:\\path\\to\\workspace"
                />
              </div>
            </div>
          </div>
        </SettingsCard>
      )
    }

    if (activeTab === 'preferences') {
      return (
        <SettingsCard
          title="使用偏好"
          description="这些选项控制进入系统后的默认页面、界面主题和列表展示方式。"
          action={
            <button
              type="button"
              onClick={() => saveAll()}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              保存偏好
            </button>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="默认首页" />
                <SelectInput
                  value={preferences.defaultHome}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      defaultHome: e.target.value as Preferences['defaultHome'],
                    }))
                  }
                >
                  <option value="dashboard">仪表盘</option>
                  <option value="projects">项目管理</option>
                  <option value="tasks">任务中心</option>
                </SelectInput>
              </div>
              <div className="space-y-2">
                <FieldLabel label="列表默认数量" />
                <TextInput
                  type="number"
                  min={5}
                  max={100}
                  value={preferences.pageSize}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      pageSize: Number(e.target.value) || defaultPreferences.pageSize,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel label="主题模式" hint="保存后会同步到现有主题存储键。" />
              <SegmentedButton
                value={preferences.themeMode}
                onChange={(themeMode) => setPreferences((prev) => ({ ...prev, themeMode }))}
                options={[
                  { value: 'light', label: '浅色', icon: Sun },
                  { value: 'dark', label: '深色', icon: Moon },
                  { value: 'system', label: '跟随系统', icon: MonitorCog },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="时间格式" />
                <SegmentedButton
                  value={preferences.timeFormat}
                  onChange={(timeFormat) => setPreferences((prev) => ({ ...prev, timeFormat }))}
                  options={[
                    { value: 'local', label: '本地时间' },
                    { value: 'iso', label: 'ISO 时间' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel label="语言" hint="MVP 阶段保留入口，默认使用中文。" />
                <SelectInput
                  value={preferences.language}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      language: e.target.value as Preferences['language'],
                    }))
                  }
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </SelectInput>
              </div>
            </div>
          </div>
        </SettingsCard>
      )
    }

    if (activeTab === 'copilot') {
      return (
        <SettingsCard
          title="Copilot 设置"
          description="保存问答、语义检索和计划生成的默认参数，后续可接入 Copilot 页面直接读取。"
          action={
            <button
              type="button"
              onClick={() => saveAll()}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              保存设置
            </button>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="默认模式" />
                <SegmentedButton
                  value={copilot.defaultMode}
                  onChange={(defaultMode) => setCopilot((prev) => ({ ...prev, defaultMode }))}
                  options={[
                    { value: 'code', label: '代码问答' },
                    { value: 'plan', label: '计划生成' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel label="默认 TopK" hint="语义检索返回的证据数量。" />
                <TextInput
                  type="number"
                  min={1}
                  max={30}
                  value={copilot.topK}
                  onChange={(e) =>
                    setCopilot((prev) => ({
                      ...prev,
                      topK: Math.max(1, Math.min(30, Number(e.target.value) || 8)),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Toggle
                checked={copilot.showReasoning}
                onChange={(showReasoning) => setCopilot((prev) => ({ ...prev, showReasoning }))}
                label="显示推理过程"
                hint="进入 Copilot 时默认展开思考过程入口。"
              />
              <Toggle
                checked={copilot.showCitations}
                onChange={(showCitations) => setCopilot((prev) => ({ ...prev, showCitations }))}
                label="默认显示引用"
                hint="回答中默认展开 citations 证据来源。"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel label="计划生成约束模板" hint="Plan 模式下自动带入的常用约束。" />
              <textarea
                value={copilot.planConstraintTemplate}
                onChange={(e) =>
                  setCopilot((prev) => ({ ...prev, planConstraintTemplate: e.target.value }))
                }
                rows={6}
                placeholder="例如：优先给出可执行步骤；标注依赖模块；避免修改无关文件。"
                className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </SettingsCard>
      )
    }

    if (activeTab === 'privacy') {
      return (
        <div className="space-y-6">
          <SettingsCard
            title="数据与隐私"
            description="CodeInsight 的代码内容主要用于本地解析、索引和检索。MVP 阶段先提供清晰的数据边界说明和本地设置管理。"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { title: '本地索引', body: '解析结果、依赖图和向量索引用于代码理解与问答检索。', icon: HardDrive },
                { title: '会话历史', body: 'Copilot 会话后续可接入全局历史接口并支持批量清理。', icon: Shield },
                { title: '实验导出', body: '支持导出当前用户设置，便于论文演示和实验记录。', icon: Download },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                    <Icon className="h-5 w-5 text-blue-600" />
                    <div className="mt-3 font-medium text-zinc-900">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{item.body}</p>
                  </div>
                )
              })}
            </div>
          </SettingsCard>
          <SettingsCard title="数据操作" description="危险操作会进行二次确认。当前前端只清理已知的本地设置和预留缓存键。">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <button
                type="button"
                onClick={exportSettings}
                disabled={maintenanceLoading === 'export'}
                className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {maintenanceLoading === 'export' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                导出系统数据
              </button>
              <button
                type="button"
                disabled={maintenanceLoading === 'copilot-history'}
                onClick={() =>
                  setConfirmAction({
                    title: '清理 Copilot 会话历史',
                    message: '将删除后端 Copilot 会话、消息记录和关联证据缓存。此操作不可撤销。',
                    confirmText: '确认清理',
                    run: () =>
                      runMaintenanceAction(
                        'copilot-history',
                        () => axios.delete('/api/profile/copilot-history'),
                        (data) =>
                          `已清理 ${data.deleted_sessions || 0} 个会话、${data.deleted_messages || 0} 条消息`,
                        () => {
                        localStorage.removeItem('codeinsight:copilot-history')
                        localStorage.removeItem('codeinsight:copilot-sessions')
                          Object.keys(localStorage)
                            .filter((key) => key.startsWith('copilot:lastSession:'))
                            .forEach((key) => localStorage.removeItem(key))
                        },
                      ),
                  })
                }
                className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {maintenanceLoading === 'copilot-history' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                清理会话历史
              </button>
              <button
                type="button"
                disabled={maintenanceLoading === 'tasks-history'}
                onClick={() =>
                  setConfirmAction({
                    title: '清理任务记录',
                    message: '将删除后端已完成和失败的历史任务记录，运行中和等待中的任务不会删除。',
                    confirmText: '确认清理',
                    run: () =>
                      runMaintenanceAction(
                        'tasks-history',
                        () => axios.delete('/api/profile/tasks/history'),
                        (data) => `已清理 ${data.deleted_tasks || 0} 条历史任务`,
                        () => {
                        localStorage.removeItem('codeinsight:task-cache')
                        },
                      ),
                  })
                }
                className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {maintenanceLoading === 'tasks-history' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                清理任务记录
              </button>
              <button
                type="button"
                disabled={maintenanceLoading === 'project-caches'}
                onClick={() =>
                  setConfirmAction({
                    title: '清理项目缓存',
                    message: '将删除后端解析结果、代码块索引和项目记忆。项目记录会保留，但已解析/已索引状态会回退为 imported。',
                    confirmText: '确认清理',
                    run: () =>
                      runMaintenanceAction(
                        'project-caches',
                        () => axios.delete('/api/profile/project-caches'),
                        (data) =>
                          `已清理 ${data.deleted_parse_results || 0} 份解析结果、${data.deleted_code_chunks || 0} 个代码块`,
                        () => {
                        localStorage.removeItem('codeinsight:project-cache')
                        },
                      ),
                  })
                }
                className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {maintenanceLoading === 'project-caches' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                清理项目缓存
              </button>
            </div>
          </SettingsCard>
        </div>
      )
    }

    if (activeTab === 'status') {
      const statusRows = [
        {
          name: 'Java 后端服务',
          status: health.backend === 'ok' ? '正常' : health.backend === 'error' ? '异常' : '未检测',
          detail: health.error || 'GET /api/health',
          ok: health.backend === 'ok',
          pending: health.backend === 'unknown',
          icon: Server,
        },
        {
          name: '存储层',
          status: health.storageType,
          detail: '由后端 health.storage 返回',
          ok: health.backend === 'ok',
          pending: health.backend === 'unknown',
          icon: Database,
        },
        {
          name: 'MongoDB',
          status: '待检测接口',
          detail: '后续由 health 接口扩展',
          ok: false,
          pending: true,
          icon: Database,
        },
        {
          name: 'Pinecone / 向量库',
          status: '待检测接口',
          detail: '后续由 health 接口扩展',
          ok: false,
          pending: true,
          icon: Database,
        },
        {
          name: 'DeepSeek / LLM',
          status: '待检测接口',
          detail: '后续由 health 接口扩展',
          ok: false,
          pending: true,
          icon: WandSparkles,
        },
      ]

      return (
        <SettingsCard
          title="系统连接状态"
          description="用于快速确认后端服务和关键依赖是否可用。"
          action={
            <button
              type="button"
              onClick={checkHealth}
              disabled={health.loading}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {health.loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              重新检测
            </button>
          }
        >
          <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {statusRows.map((row) => {
              const Icon = row.icon
              return (
                <div key={row.name} className="flex items-center gap-4 px-4 py-4">
                  <div className="rounded-lg bg-zinc-100 p-2 text-zinc-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900">{row.name}</div>
                    <div className="mt-1 truncate text-sm text-zinc-500">{row.detail}</div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      row.ok
                        ? 'bg-emerald-100 text-emerald-700'
                        : row.pending
                          ? 'bg-zinc-100 text-zinc-600'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {row.ok ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
                    {row.status}
                  </span>
                </div>
              )
            })}
          </div>
          {health.checkedAt && <p className="mt-3 text-xs text-zinc-500">最近检测：{health.checkedAt}</p>}
        </SettingsCard>
      )
    }

    return (
      <div className="space-y-6">
        <SettingsCard title="安全与登录" description="MVP 阶段先提供登录状态展示、退出登录和安全能力预留入口。">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-4">
              <User className="h-5 w-5 text-blue-600" />
              <div className="mt-3 font-medium text-zinc-900">{profile.displayName}</div>
              <div className="mt-1 text-sm text-zinc-500">{profile.email}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <KeyRound className="h-5 w-5 text-zinc-600" />
              <div className="mt-3 font-medium text-zinc-900">修改密码</div>
              <div className="mt-1 text-sm text-zinc-500">认证体系接入后启用。</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <Shield className="h-5 w-5 text-zinc-600" />
              <div className="mt-3 font-medium text-zinc-900">API Key 管理</div>
              <div className="mt-1 text-sm text-zinc-500">敏感配置检查入口预留。</div>
            </div>
          </div>
        </SettingsCard>
        <SettingsCard title="登录操作">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium text-zinc-900">退出当前登录</div>
              <p className="mt-1 text-sm text-zinc-500">退出后将返回登录页，个人设置仍保留在本地。</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfirmAction({
                  title: '退出登录',
                  message: '确定要退出当前登录状态并返回登录页吗？',
                  confirmText: '退出登录',
                  run: logout,
                })
              }
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </button>
          </div>
        </SettingsCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">个人中心</h1>
          <p className="mt-1 text-sm text-zinc-500">管理账号资料、界面偏好、Copilot 参数和安全配置。</p>
        </div>
        {savedMessage && (
          <div className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {savedMessage}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-zinc-200 bg-white p-2 xl:self-start">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className={`mt-0.5 block truncate text-xs ${active ? 'text-blue-600' : 'text-zinc-500'}`}>
                    {tab.description}
                  </span>
                </span>
                {active && <ChevronRight className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </aside>

        <div>{renderContent()}</div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          onConfirm={confirmAction.run}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
