import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Library from './pages/Library'
import Search from './pages/Search'
import MovieDetail from './pages/MovieDetail'
import Import from './pages/Import'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Login from './pages/Login'
import Register from './pages/Register'
import Lists from './pages/Lists'
import ListDetail from './pages/ListDetail'
import TestMatch from './pages/TestMatch'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/library" replace />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/movies/:id" element={<MovieDetail />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/lists" element={<Lists />} />
                  <Route path="/lists/:listId" element={<ListDetail />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/test" element={<TestMatch />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
