import dotenv from 'dotenv'

// load env
dotenv.config()

import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import taskRoutes from './routes/tasks.js'
import { isSupabaseConfigured } from './lib/supabase.js'

const app = express()

app.set('etag', false)

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/tasks', taskRoutes)

app.use('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ok',
    supabase: { configured: isSupabaseConfigured() },
  })
})

/**
 * error handler middleware
 */
app.use((error, req, res, next) => {
  console.error('[Server Error]:', error)
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
