import { NavLink } from 'react-router-dom'
import { Home, ArrowLeftRight, PieChart, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/budget', icon: PieChart, label: 'Budget' },
  { to: '/goals', icon: Target, label: 'Goals' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950">
      <div className="flex h-16 items-stretch">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                isActive
                  ? 'text-indigo-400'
                  : 'text-zinc-500 hover:text-zinc-300',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
