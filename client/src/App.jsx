import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './context/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import IntakeForm from './pages/IntakeForm';
import DraftPreview from './pages/DraftPreview';
import ReviewerWorkspace from './pages/ReviewerWorkspace';
import ExportPage from './pages/ExportPage';
import SebiUpdatesPage from './pages/SebiUpdatesPage';
import InvitationsPage from './pages/InvitationsPage';
import ComplianceChecklistPage from './pages/ComplianceChecklistPage';
import GapAnalysisPage from './pages/GapAnalysisPage';
import IpoReadinessPage from './pages/IpoReadinessPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/intake" element={<IntakeForm />} />
                    <Route path="/draft" element={<DraftPreview initialMode="chapter" />} />
                    <Route path="/draft-preview" element={<DraftPreview initialMode="preview" />} />
                    <Route path="/compliance-checklist" element={<ComplianceChecklistPage />} />
                    <Route path="/gap-analysis" element={<GapAnalysisPage />} />
                    <Route path="/readiness" element={<IpoReadinessPage />} />
                    <Route
                      path="/reviewer"
                      element={
                        <ProtectedRoute requiredRole="reviewer">
                          <ReviewerWorkspace />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/export" element={<Navigate to="/draft-preview" replace />} />
                    <Route path="/sebi-updates" element={<SebiUpdatesPage />} />
                    <Route path="/invitations" element={<InvitationsPage />} />
                    <Route path="*" element={<Dashboard />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
