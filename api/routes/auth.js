import { Router } from 'express'

const router = Router()

router.post('/register', async (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' })
})

router.post('/login', async (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' })
})

router.post('/logout', async (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' })
})

export default router
