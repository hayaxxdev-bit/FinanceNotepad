const express = require('express')
const { router } = express.Router()
const { authMiddleware } = require("../middleware/auth")

// SignUp
router.post('/signup', (req, res) => {
    try {
        const { email, password, fullName } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and Password require' })
        }

        if (password.lenght < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' })
        }

        const { data, error } = await req.supabase.auth.signUp({
            email,
            password,
            options: {
                data: { fullName: fullName || '' }
            }
        })

        if (error) throw error

        // set session cookies
        if (data.session) {
            res.cookies('sb_token', data.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            })
        }

        res.status(201).json({
            message: 'create account succesfully',
            user: data.user
        })
    } catch (error) {
        console.error('Signup error', error);
        res.status(400).json({ error: error.message })
    }
})

// login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and Password require' })
        }

        const { data, error } = await req.supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error

        // set session cookies
        res.cookies('sb_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        res.json({
            message: 'Login Succesfully',
            user: data.user
        })
    } catch (error) {
        console.error('Login error', error);
        res.status(401).json({ error: error.message })
    }
})

// logout
router.post('/logout', async (req, res) => {
    try {
        const { error } = await req.supabase.auth.signOut()
        if (error) throw error

        res.clearCookies('sb_token')
        res.json({ message: 'Logged out Succesfully' })
    } catch (error) {
        console.error('Logout error', error);
        res.status(500).json({ error: error.message })
    }
})

// get current user
router.get('/me', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            fullName: req.user.user_metadata?.full_name,
            createdAt:req.user.created_at
        }
    })
})

// refresh session 
router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await req.supabase.auth.refreshSession()
        if (error) throw error

        res.cookies('sb_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        res.json({ message: 'session refreshed' })
    } catch (error) {
        console.error('Refresh error', error);
        res.status(401).json({ error: 'session refresh failed' })
    }
})

module.exports = router