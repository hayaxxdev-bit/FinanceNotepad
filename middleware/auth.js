const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.sb_token || req.headers.authorization?.split(' ')[1]

        if (!token) {
            return res.status(401).json({ error: 'Authentication require' })
        }

        const { data: { user }, error } = await res.supabase.auth.getUser(token)

        if (error || !user) {
            res.clearCookie('sb_token')
            return res.status(401).json({ error: 'Invalid or expired token' })
        }

        req.user = user
        next()
    } catch (error) {
        console.error('Auth middleware error', error);
        res.status(500).json({ error: 'Authentication failed' })
    }
}

const optionalAuth = (req, re, next) => {
    try {
        const token = req.cookies?.sb_token || req.headers.authorization?.split(' ')[1]

        if (token) {
            const { data: { user } } = await req.supabase.auth.getUser(token)
            req.user = user
        }

    } catch (error) {
        // ignore
    }
    next()
}

module.exports = { authMiddleware, optionalAuth }