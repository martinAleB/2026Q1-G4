import { Outlet } from 'react-router-dom'

import { DashboardHeader } from '@/components/shared/DashboardHeader'
import { DashboardSidebar } from '@/components/shared/DashboardSidebar'

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
