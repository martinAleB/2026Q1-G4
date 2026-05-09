import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'

const AUTH_STORAGE_KEY = 'cloud-dashboard-auth'
const TOKENS_STORAGE_KEY = 'cloud-dashboard-tokens'

const AuthContext = createContext(null)

function getStoredUser() {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token=') && hash.includes('id_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const accessToken = params.get('access_token')
      const idToken = params.get('id_token')

      if (accessToken && idToken) {
        try {
          const decoded = jwtDecode(idToken)
          
          const payload = {
            name: decoded.name || decoded.email?.split('@')[0] || 'User',
            email: decoded.email,
            sub: decoded.sub
          }

          setUser(payload)
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
          window.localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify({ accessToken, idToken }))
          
          window.history.replaceState(null, '', window.location.pathname)
        } catch (err) {
          console.error('Error decodificando el token:', err)
        }
      }
    }
    setIsReady(true)
  }, [])

  const login = () => {
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const redirectUri = import.meta.env.VITE_API_GATEWAY_CALLBACK_URL
    
    if (!cognitoDomain || !clientId || !redirectUri) {
        console.error("Faltan variables de entorno para Cognito")
        return
    }

    const loginUrl = `${cognitoDomain}/login?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.location.href = loginUrl
  }

  const logout = () => {
    setUser(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.localStorage.removeItem(TOKENS_STORAGE_KEY)
    window.location.href = '/'
  }

  const contextValue = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user],
  )

  if (!isReady) return null;

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
