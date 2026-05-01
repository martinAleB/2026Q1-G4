/* eslint-disable react-refresh/only-export-components */

import { createElement, lazy, Suspense } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'

import { DashboardLayout } from '@/components/shared/DashboardLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const CreateAccountPage = lazy(() => import('@/pages/CreateAccountPage'))
const ProductsPage = lazy(() => import('@/pages/dashboard/ProductsPage'))
const ParametersPage = lazy(() => import('@/pages/dashboard/ParametersPage'))
const PortfolioPage = lazy(() => import('@/pages/dashboard/PortfolioPage'))
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: withSuspense(LandingPage),
  },
  {
    path: '/login',
    element: withSuspense(LoginPage),
  },
  {
    path: '/create-account',
    element: withSuspense(CreateAccountPage),
  },
  {
    path: '/register',
    element: <Navigate to="/create-account" replace />,
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
    ],
  },
  {
    path: '*',
    element: withSuspense(NotFoundPage),
  },
])
