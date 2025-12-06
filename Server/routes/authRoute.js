import express from 'express'
import { googelAuth } from '../controllers/AuthenticationControllers.js'

const router = express.Router()

// Log route registration
console.log("📋 Auth routes registered: POST /api/auth/google-auth");

router.post('/google-auth', googelAuth)

export default router;