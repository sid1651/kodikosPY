import express from 'express'
import { googelAuth } from '../controllers/AuthenticationControllers.js'


const router=express.Router()
router.post('/googel-auth',googelAuth)

export default router;