import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()

  const showBack = location.pathname !== '/'

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Dashboard'
      default:
        return 'PharmaGuard'
    }
  }

  return (
    <header className="w-full sticky top-0 z-50 bg-neutral-900 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        {/* Left Section - Back Button + Logo */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white text-sm shadow-md">
              💊
            </div>
            <div className="text-white">
              <div className="text-base font-bold tracking-tight">PharmaGuard</div>
              <div className="text-[10px] text-neutral-400">Genomic Drug Safety</div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}
