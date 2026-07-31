import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './context/AuthContext';
import Layout from './components/Layout';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import IntakeForm from './pages/IntakeForm';
import DocumentsPage from './pages/DocumentsPage';
import DraftPreview from './pages/DraftPreview';
import ReviewerWorkspace from './pages/ReviewerWorkspace';
import ExportPage from './pages/ExportPage';
import SebiUpdatesPage from './pages/SebiUpdatesPage';

export default function App() {
  return (
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
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/draft" element={<DraftPreview />} />
                  <Route
                    path="/reviewer"
                    element={
                      <ProtectedRoute requiredRole="reviewer">
                        <ReviewerWorkspace />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/export" element={<ExportPage />} />
                  <Route path="/sebi-updates" element={<SebiUpdatesPage />} />
                  <Route path="*" element={<Dashboard />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
