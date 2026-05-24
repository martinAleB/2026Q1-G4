/* eslint-disable react-refresh/only-export-components */

import { createElement, lazy, Suspense } from 'react'
import { Navigate, createHashRouter } from 'react-router-dom'

import { DashboardLayout } from '@/components/shared/DashboardLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { useAuth } from '@/store/AuthContext'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const ProductsPage = lazy(() => import('@/pages/dashboard/ProductsPage'))
const ParametersPage = lazy(() => import('@/pages/dashboard/ParametersPage'))
const PortfolioPage = lazy(() => import('@/pages/dashboard/PortfolioPage'))
const SimulationsPage = lazy(() => import('@/pages/dashboard/SimulationsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      Cargando pagina...
    </div>
  )
}

function withSuspense(LazyComponent) {
  return (
    <Suspense fallback={<PageLoader />}>
      {createElement(LazyComponent)}
    </Suspense>
  )
}

function OnboardingRoute({ children }) {
  const { isAuthenticated, needsOnboarding, isLoadingFintech } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isLoadingFintech) {
    return <PageLoader />
  }

  if (!needsOnboarding) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export const router = createHashRouter([
  {
    path: '/',
    element: withSuspense(LandingPage),
  },
  {
    path: '/login',
    element: withSuspense(LoginPage),
  },
  {
    path: '/onboarding',
    element: <OnboardingRoute>{withSuspense(OnboardingPage)}</OnboardingRoute>,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="products" replace />,
      },
      {
        path: 'products',
        element: withSuspense(ProductsPage),
      },
      {
        path: 'parameters',
        element: withSuspense(ParametersPage),
      },
      {
        path: 'portfolio',
        element: withSuspense(PortfolioPage),
      },
      {
        path: 'simulations',
        element: withSuspense(SimulationsPage),
      },
    ],
  },
  {
    path: '*',
    element: withSuspense(NotFoundPage),
  },
])
