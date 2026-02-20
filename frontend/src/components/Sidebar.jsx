import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Sidebar(){
  const loc = useLocation()
  const nav = [
    {to:'/', label:'Home'},
    {to:'/dashboard', label:'Dashboard'}
  ]
  return (
    <aside className="w-64 py-6 px-4 glass border-r">
      <div className="text-sm mb-6 text-[var(--muted)]">Navigation</div>
      <ul className="space-y-2">
        <li><Link to="/dashboard" className="block px-3 py-2 rounded-md hover:bg-white/2 text-[var(--text)]">Dashboard</Link></li>
        <li><Link to="/history" className="block px-3 py-2 rounded-md hover:bg-white/2 text-[var(--text)]">History</Link></li>
        <li><Link to="/settings" className="block px-3 py-2 rounded-md hover:bg-white/2 text-[var(--text)]">Settings</Link></li>
      </ul>
    </aside>
  )
}
