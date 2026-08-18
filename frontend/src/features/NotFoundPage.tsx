import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-5xl font-semibold text-slate-300">404</p>
      <p className="text-sm text-slate-500">This page doesn't exist.</p>
      <Link to="/">
        <Button variant="primary">Back to dashboard</Button>
      </Link>
    </div>
  )
}
