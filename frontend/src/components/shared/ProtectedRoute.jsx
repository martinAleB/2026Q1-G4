import { Navigate } from 'react-router-dom'

import { useAuth } from '@/store/AuthContext'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, needsOnboarding, isLoadingFintech, fintechData } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isLoadingFintech && !fintechData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
