import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import '@cloudscape-design/global-styles/index.css';
import { AppProvider } from './contexts/AppContext';
import { OriginProvider } from './contexts/OriginContext';
import { TransformationPolicyProvider } from './contexts/TransformationPolicyContext';
import { NotificationBar } from './components/common/NotificationBar';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { GlobalErrorFallback } from './components/error/GlobalErrorFallback';
import { LoadingFallback } from './components/common/LoadingFallback';
import { ROUTES } from './constants/routes';
import AuthWrapper from './components/auth/AuthWrapper';
import Footer from './components/common/Footer';
import { UserProvider } from './contexts/UserContext';

// Route-based lazy loading
const Origins = lazy(() => import('./pages/Origins'));
const CreateOrigin = lazy(() => import('./pages/CreateOrigin'));
const OriginDetails = lazy(() => import('./pages/OriginDetails'));
const Mappings = lazy(() => import('./pages/Mappings'));
const CreateMapping = lazy(() => import('./pages/CreateMapping'));
const MappingDetails = lazy(() => import('./pages/MappingDetails'));
const LogoutComplete = lazy(() => import('./pages/LogoutComplete'));
const TransformationPolicies = lazy(() => import('./pages/TransformationPolicies'));
const CreateTransformationPolicy = lazy(() => import('./pages/CreateTransformationPolicy'));
const TransformationPolicyDetails = lazy(() => import('./pages/TransformationPolicyDetails'));

const AppContent: React.FC = () => {
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <div className="App">
        <NotificationBar />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/auth/logout-complete" element={<LogoutComplete />} />
            <Route path="/*" element={
              <AuthWrapper>
                <Routes>
                  <Route index element={<Navigate to={ROUTES.ORIGINS} replace />} />
                  <Route path="origins" element={<Origins />} />
                  <Route path="origins/create" element={<CreateOrigin />} />
                  <Route path="origins/:id" element={<OriginDetails />} />
                  <Route path="origins/:id/edit" element={<CreateOrigin />} />
                  <Route path="mappings" element={<Mappings />} />
                  <Route path="mappings/create" element={<CreateMapping />} />
                  <Route path="mappings/:id" element={
                    <OriginProvider>
                      <TransformationPolicyProvider>
                        <MappingDetails />
                      </TransformationPolicyProvider>
                    </OriginProvider>
                  } />
                  <Route path="mappings/:id/edit" element={<CreateMapping />} />
                  <Route path="transformation-policies" element={<TransformationPolicies />} />
                  <Route path="transformation-policies/create" element={
                    <TransformationPolicyProvider>
                      <CreateTransformationPolicy />
                    </TransformationPolicyProvider>
                  } />
                  <Route path="transformation-policies/:id" element={
                    <TransformationPolicyProvider>
                      <TransformationPolicyDetails />
                    </TransformationPolicyProvider>
                  } />
                  <Route path="transformation-policies/:id/edit" element={
                    <TransformationPolicyProvider>
                      <CreateTransformationPolicy />
                    </TransformationPolicyProvider>
                  } />
                </Routes>
              </AuthWrapper>
            } />
          </Routes>
        </Suspense>
        <Footer />
      </div>
    </Router>
  );
};

function App() {
  return (
    <ErrorBoundary 
      fallback={<GlobalErrorFallback />}
      context="App"
    >
      <UserProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;