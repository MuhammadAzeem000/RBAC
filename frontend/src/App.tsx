import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { UsersListPage } from '@/features/users/UsersListPage'
import { UserDetailPage } from '@/features/users/UserDetailPage'
import { DepartmentsListPage } from '@/features/departments/DepartmentsListPage'
import { DepartmentDetailPage } from '@/features/departments/DepartmentDetailPage'
import { RolesListPage } from '@/features/roles/RolesListPage'
import { RoleDetailPage } from '@/features/roles/RoleDetailPage'
import { ModulesListPage } from '@/features/modules/ModulesListPage'
import { ModuleDetailPage } from '@/features/modules/ModuleDetailPage'
import { ActionsListPage } from '@/features/actions/ActionsListPage'
import { ActionDetailPage } from '@/features/actions/ActionDetailPage'
import { PermissionsListPage } from '@/features/permissions/PermissionsListPage'
import { PermissionDetailPage } from '@/features/permissions/PermissionDetailPage'
import { NotFoundPage } from '@/features/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />

          <Route path="users" element={<UsersListPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />

          <Route path="departments" element={<DepartmentsListPage />} />
          <Route path="departments/:id" element={<DepartmentDetailPage />} />

          <Route path="roles" element={<RolesListPage />} />
          <Route path="roles/:id" element={<RoleDetailPage />} />

          <Route path="modules" element={<ModulesListPage />} />
          <Route path="modules/:id" element={<ModuleDetailPage />} />

          <Route path="actions" element={<ActionsListPage />} />
          <Route path="actions/:id" element={<ActionDetailPage />} />

          <Route path="permissions" element={<PermissionsListPage />} />
          <Route path="permissions/:id" element={<PermissionDetailPage />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}

export default App
