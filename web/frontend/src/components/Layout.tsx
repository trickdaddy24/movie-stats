import { NavLink, Outlet } from 'react-router-dom'
import { Film, Library, Upload, Settings, FlaskConical, PlusCircle, Sun, Moon, BarChart2, LogOut, ListChecks } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getKeyStatus } from '../lib/api'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const VERSION = '1.6.5'

function KeyStatusDot() {
  const { data: keys } = useQuery({ queryKey: ['settings-keys'], queryFn: getKeyStatus })
  const allGood = keys?.filter(k => k.required).every(k => k.configured) ?? null
  if (allGood === null) return null
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${allGood ? 'bg-green-400' : 'bg-red-400'}`} />
  )
}

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
  }`

export default function Layout() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { auth, logout } = useAuth()

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <Film className="w-7 h-7 text-brand-500 flex-shrink-0" />
          <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">MovieStats</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/library" className={NAV_LINK_CLASS}>
            <Library className="w-4 h-4" /> Library
          </NavLink>
          <NavLink to="/stats" className={NAV_LINK_CLASS}>
            <BarChart2 className="w-4 h-4" /> Stats
          </NavLink>
          <NavLink to="/lists" className={NAV_LINK_CLASS}>
            <ListChecks className="w-4 h-4" /> Lists
          </NavLink>
          <NavLink to="/search" className={NAV_LINK_CLASS}>
            <PlusCircle className="w-4 h-4" /> Add Movie
          </NavLink>
          <NavLink to="/import" className={NAV_LINK_CLASS}>
            <Upload className="w-4 h-4" /> Import
          </NavLink>
          <NavLink to="/test" className={NAV_LINK_CLASS}>
            <FlaskConical className="w-4 h-4" /> Test Match
          </NavLink>
          <NavLink to="/settings" className={NAV_LINK_CLASS}>
            <Settings className="w-4 h-4" />
            <span className="flex-1">Settings</span>
            <KeyStatusDot />
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-600 truncate">
                {auth.user?.username}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-600">v{VERSION}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={toggle}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
