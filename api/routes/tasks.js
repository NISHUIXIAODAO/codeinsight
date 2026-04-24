import { Router } from 'express'
import { getSupabaseAdmin } from '../lib/supabase.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : null
    const status = typeof req.query.status === 'string' ? req.query.status : null
    const taskType = typeof req.query.task_type === 'string' ? req.query.task_type : null
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200)

    let q = supabase
      .from('tasks')
      .select('id,project_id,task_type,status,config,result,created_at,completed_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (projectId) q = q.eq('project_id', projectId)
    if (status) q = q.eq('status', status)
    if (taskType) q = q.eq('task_type', taskType)

    const { data, error } = await q
    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }
    res.status(200).json({ success: true, data: data ?? [] })
  } catch (e) {
    console.error('[Route Error /api/tasks]:', e)
    res.status(500).json({ success: false, error: e?.message || 'Server internal error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const taskId = req.params.id
    const { data, error } = await supabase
      .from('tasks')
      .select('id,project_id,task_type,status,config,result,created_at,completed_at')
      .eq('id', taskId)
      .single()

    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }

    res.status(200).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || 'Server internal error' })
  }
})

export default router
