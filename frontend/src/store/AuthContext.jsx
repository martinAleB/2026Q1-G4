import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'

const AUTH_STORAGE_KEY = 'cloud-dashboard-auth'
const TOKENS_STORAGE_KEY = 'cloud-dashboard-tokens'
const MOCK = import.meta.env.VITE_MOCK === 'true'
const MOCK_USER = { name: 'Usuario Mock', email: 'mock@example.com', sub: 'mock-sub-123' }

const AuthContext = createContext(null)

function getStoredUser() {
  if (typeof window === 'undefined') return null
  if (MOCK) return MOCK_USER

  const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEY)
  const rawTokens = window.localStorage.getItem(TOKENS_STORAGE_KEY)
  
  if (!rawUser || !rawTokens) {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(TOKENS_STORAGE_KEY)
    } catch (e) {
      // Ignorar fallas al intentar remover items del localStorage en entornos restringidos
    }
    return null
  }

  try {
    const tokens = JSON.parse(rawTokens)
    if (!tokens?.idToken) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(TOKENS_STORAGE_KEY)
      return null
    }

    const decoded = jwtDecode(tokens.idToken)
    const currentTime = Date.now() / 1000
    
    if (decoded.exp && decoded.exp < currentTime) {
      console.warn('La sesión ha expirado (Token vencido).')
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(TOKENS_STORAGE_KEY)
      return null
    }

    return JSON.parse(rawUser)
  } catch (err) {
    console.error('Error al validar la sesión almacenada:', err)
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(TOKENS_STORAGE_KEY)
    } catch (e) {
      // Ignorar fallas al intentar remover items del localStorage en entornos restringidos
    }
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [isReady, setIsReady] = useState(false)
  const [fintechData, setFintechData] = useState(null)
  const [isLoadingFintech, setIsLoadingFintech] = useState(false)

  const fetchFintech = async (tokens) => {
    if (MOCK) {
      setFintechData({ fintech_name: 'Mock Fintech' })
      return
    }

    const storedTokens = JSON.parse(window.localStorage.getItem(TOKENS_STORAGE_KEY) || '{}')
    const idToken = tokens?.idToken || storedTokens.idToken
    
    if (!idToken) {
      console.warn('No idToken found for fetching fintech data')
      setFintechData({}) 
      return
    }

    setIsLoadingFintech(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_CALLBACK_URL.replace('/callback', '')}/fintech`, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setFintechData(data || {})
      } else if (response.status === 404) {
        setFintechData({})
      } else {
        setFintechData({ error: true })
      }
    } catch (err) {
      console.error('Error fetching fintech:', err)
      setFintechData({ error: true })
    } finally {
      setIsLoadingFintech(false)
    }
  }

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

          window.location.hash = '/dashboard'
          
          fetchFintech({ accessToken, idToken })
        } catch (err) {
          console.error('Error decodificando el token:', err)
        }
      }
    }
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (user && !fintechData && !isLoadingFintech) {
      fetchFintech()
    }
  }, [user, fintechData, isLoadingFintech])

  const login = () => {
    if (MOCK) {
      setUser(MOCK_USER)
      setFintechData({ fintech_name: 'Mock Fintech' })
      return
    }

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

  const signup = () => {
    if (MOCK) {
      setUser(MOCK_USER)
      setFintechData({ fintech_name: 'Mock Fintech' })
      return
    }

    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const redirectUri = import.meta.env.VITE_API_GATEWAY_CALLBACK_URL

    if (!cognitoDomain || !clientId || !redirectUri) {
        console.error("Faltan variables de entorno para Cognito")
        return
    }

    const signupUrl = `${cognitoDomain}/signup?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.location.href = signupUrl
  }

  const logout = () => {
    setUser(null)
    setFintechData(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.localStorage.removeItem(TOKENS_STORAGE_KEY)
    window.location.href = '/'
  }

  const contextValue = useMemo(
    () => ({
      user,
      fintechData,
      isLoadingFintech,
      isAuthenticated: Boolean(user),
      needsOnboarding: Boolean(user && fintechData !== null && !isLoadingFintech && !fintechData?.fintech_name),
      login,
      signup,
      logout,
      refreshFintech: fetchFintech
    }),
    [user, fintechData, isLoadingFintech],
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
