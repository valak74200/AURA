import React, { useEffect, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { LanguageProvider } from './contexts/LanguageContext';
import ModernLayout from './components/layout/ModernLayout';
import { LoadingSpinner, ToastProvider } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary';
import QueryErrorBoundary from './components/QueryErrorBoundary';

// Lazy-loaded page imports for better performance
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const ModernAuthPage = React.lazy(() => import('./pages/auth/ModernAuthPage'));
const ModernDashboard = React.lazy(() => import('./pages/ModernDashboard'));
const SessionsPage = React.lazy(() => import('./pages/sessions/SessionsPage'));
const ModernNewSessionPage = React.lazy(() => import('./pages/sessions/ModernNewSessionPage'));
const SessionDetailPage = React.lazy(() => import('./pages/sessions/SessionDetailPage'));
const AnalyticsPage = React.lazy(() => import('./pages/analytics/AnalyticsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const TtsTestPage = React.lazy(() => import('./pages/TtsTest'));
const AgentPage = React.lazy(() => import('./pages/AgentPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component for lazy-loaded pages
const PageLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading page...</p>
    </div>
  </div>
);

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if authenticated)
const PublicRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  // Pour les pages d'auth (login/register), rediriger vers dashboard si connecté
  // Pour la landing page, on laisse passer
  if (isAuthenticated && (window.location.pathname === '/login' || window.location.pathname === '/register')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// App Component
function App() {
  const { checkAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await checkAuth();
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [checkAuth]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Initializing AURA...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="dark">
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <QueryErrorBoundary>
              <ToastProvider position="top-right">
                <Router>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                      {/* Public routes */}
                      <Route
                        path="/login"
                        element={
                          <PublicRoute>
                            <ModernAuthPage mode="login" />
                          </PublicRoute>
                        }
                      />
                      <Route
                        path="/register"
                        element={
                          <PublicRoute>
                            <ModernAuthPage mode="register" />
                          </PublicRoute>
                        }
                      />
                      
                      {/* Protected routes */}
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <ModernLayout>
                              <ModernDashboard />
                            </ModernLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/sessions"
                        element={
                          <ProtectedRoute>
                            <ModernLayout>
                              <SessionsPage />
                            </ModernLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/sessions/new"
                        element={
                          <ProtectedRoute>
                            <ModernLayout>
                              <ModernNewSessionPage />
                            </ModernLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/sessions/:id"
                        element={
                          <ProtectedRoute>
                            <ModernLayout>
                              <SessionDetailPage />
                            </ModernLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/analytics"
                        element={
                          <ProtectedRoute>
                            <ModernLayout>
                              <AnalyticsPage />
                            </ModernLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <ModernLayout>
                              <SettingsPage />
                            </ModernLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/agent"
                        element={
                          <ProtectedRoute>
                            <AgentPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Public routes */}
                      <Route
                        path="/pricing"
                        element={
                          <PublicRoute>
                            <PricingPage />
                          </PublicRoute>
                        }
                      />

                      {/* Public test route for real-time TTS */}
                      <Route
                        path="/tts-test"
                        element={
                          <PublicRoute>
                            <TtsTestPage />
                          </PublicRoute>
                        }
                      />
                      
                      {/* Landing page for non-authenticated users */}
                      <Route
                        path="/"
                        element={
                          <PublicRoute>
                            <LandingPage />
                          </PublicRoute>
                        }
                      />
                      
                      {/* 404 fallback */}
                      <Route
                        path="*"
                        element={
                          <ModernLayout showSidebar={false}>
                            <div className="min-h-screen flex items-center justify-center">
                              <div className="text-center">
                                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                                <p className="text-gray-600 mb-4">Page not found</p>
                                <a href="/dashboard" className="text-primary-600 hover:text-primary-700">
                                  Return to Dashboard
                                </a>
                              </div>
                            </div>
                          </ModernLayout>
                        }
                      />
                    </Routes>
                  </Suspense>
                </Router>
              </ToastProvider>
            </QueryErrorBoundary>
            
            {/* React Query Devtools */}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </LanguageProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;
