import { Router } from 'express'
import { getSupabaseAdmin } from '../lib/supabase.js'
import { buildRepoGraph } from '../lib/repoGraph.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('projects')
      .select('id,name,url,language,status,created_at,updated_at')
      .order('updated_at', { ascending: false })

    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }

    res.status(200).json({ success: true, data: data ?? [] })
  } catch (e) {
    console.error('[Route Error /api/projects]:', e)
    res.status(500).json({ success: false, error: e?.message || 'Server internal error' })
  }
})

router.post('/import', async (req, res) => {
  try {
    const { name, url, path, language } = req.body || {}
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }

    const supabase = getSupabaseAdmin()

    const { data: inserted, error: insertError } = await supabase
      .from('projects')
      .insert([
        {
          name,
          url: typeof url === 'string' ? url : null,
          language: typeof language === 'string' ? language : null,
          status: 'imported',
        },
      ])
      .select('id,name,url,language,status,created_at,updated_at')
      .single()

    if (insertError) {
      res.status(500).json({ success: false, error: insertError.message })
      return
    }

    const { data: taskInserted } = await supabase.from('tasks').insert([
      {
        project_id: inserted.id,
        task_type: 'parse',
        config: {
          url: typeof url === 'string' ? url : null,
          path: typeof path === 'string' ? path : null,
          language: typeof language === 'string' ? language : null,
        },
        status: 'pending',
      },
    ]).select('id').maybeSingle()

    const taskId = taskInserted?.id
    const localPath = typeof path === 'string' ? path : null
    if (taskId && localPath) {
      setTimeout(async () => {
        try {
          await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId)
          const graph = buildRepoGraph(localPath, {})
          await supabase.from('parse_results').insert([
            {
              project_id: inserted.id,
              ast_data: null,
              dependencies: graph,
            },
          ])
          await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
          await supabase.from('projects').update({ status: 'parsed' }).eq('id', inserted.id)
        } catch (e) {
          await supabase.from('tasks').update({ status: 'failed', result: { error: e?.message || String(e) } }).eq('id', taskId)
          await supabase.from('projects').update({ status: 'failed' }).eq('id', inserted.id)
        }
      }, 0)
    }

    res.status(201).json({ success: true, data: inserted })
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || 'Server internal error' })
  }
})

router.post('/:id/parse', async (req, res) => {
  try {
    const projectId = req.params.id
    const { path: localPath } = req.body || {}
    if (!localPath || typeof localPath !== 'string') {
      res.status(400).json({ success: false, error: 'path is required' })
      return
    }
    const supabase = getSupabaseAdmin()
    const { data: taskInserted, error: taskErr } = await supabase.from('tasks').insert([
      { project_id: projectId, task_type: 'parse', config: { path: localPath }, status: 'pending' },
    ]).select('id').single()
    if (taskErr) {
      res.status(500).json({ success: false, error: taskErr.message })
      return
    }

    const taskId = taskInserted.id
    setTimeout(async () => {
      try {
        await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId)
        const graph = buildRepoGraph(localPath, {})
        await supabase.from('parse_results').insert([{ project_id: projectId, ast_data: null, dependencies: graph }])
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
        await supabase.from('projects').update({ status: 'parsed' }).eq('id', projectId)
      } catch (e) {
        await supabase.from('tasks').update({ status: 'failed', result: { error: e?.message || String(e) } }).eq('id', taskId)
        await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId)
      }
    }, 0)

    res.status(202).json({ success: true, data: { task_id: taskId } })
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || 'Server internal error' })
  }
})

router.get('/:id/dependencies', async (req, res) => {
  try {
    const projectId = req.params.id
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('parse_results')
      .select('dependencies,created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }

    const deps = data?.dependencies || null
    if (deps && typeof deps === 'object' && Array.isArray(deps.nodes) && Array.isArray(deps.links)) {
      res.status(200).json({ success: true, data: deps })
      return
    }

    res.status(200).json({ success: true, data: { nodes: [], links: [] } })
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || 'Server internal error' })
  }
})

export default router
