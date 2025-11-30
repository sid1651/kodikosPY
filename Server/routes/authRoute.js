import express from 'express'
import { googelAuth } from '../controllers/AuthenticationControllers.js'


const router=express.Router()
router.post('/google-auth',googelAuth)

export default router;