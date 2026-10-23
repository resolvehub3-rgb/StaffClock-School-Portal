/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { LoginPage } from './pages/LoginPage';
import { TeacherActivationPage } from './pages/TeacherActivationPage';
import { FirstRunSetupPage } from './pages/FirstRunSetupPage';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { HeadmasterDashboard } from './pages/HeadmasterDashboard';
import { School, Loader2 } from 'lucide-react';

function AppContent() {
  const { user, role, activeRoleView, isLoading, isSupabaseConnected, schoolSettings, refreshSettings, refreshProfile } = useAuth();
  const [currentView, setCurrentView] = useState<'login' | 'activate' | 'setup' | 'main'>('login');
  const [activationToken, setActivationToken] = useState<string>('');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Check URL query params for ?activate=TOKEN, ?setup=1, or ?view=admin/teacher
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('activate');
    const viewParam = params.get('view');
    if (token) {
      setActivationToken(token);
      setCurrentView('activate');
    } else if (params.get('setup') === '1') {
      setCurrentView('setup');
    } else if (viewParam === 'admin' || viewParam === 'teacher' || viewParam === 'headmaster' || viewParam === 'assistant_headmaster') {
      setCurrentView('main');
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C62828] text-white shadow-md animate-pulse">
          <School className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#667085]">
          <Loader2 className="w-4 h-4 animate-spin text-[#C62828]" />
          <span>Connecting to StaffClock System...</span>
        </div>
      </div>
    );
  }

  const viewParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;

  // Invitation activation takes priority: a teacher opening an ?activate=
  // link must land on the activation page even if a session already exists
  if (currentView === 'activate') {
    return (
      <>
        <TeacherActivationPage
          initialToken={activationToken}
          onActivated={() => {
            // Clear URL query param
            window.history.replaceState({}, document.title, window.location.pathname);
          }}
          onGoToLogin={() => setCurrentView('login')}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Not authenticated flows
  if (!user && !viewParam) {
    if (currentView === 'setup') {
      return (
        <>
          <FirstRunSetupPage
            onSetupComplete={() => {
              refreshSettings();
              refreshProfile();
              setCurrentView('login');
            }}
            onGoToLogin={() => setCurrentView('login')}
          />
          <OfflineIndicator />
          <SupabaseConfigModal
            isOpen={isSupabaseModalOpen}
            onClose={() => setIsSupabaseModalOpen(false)}
            onConfigSaved={() => {
              refreshSettings();
              refreshProfile();
            }}
          />
        </>
      );
    }

    return (
      <>
        <LoginPage
          onGoToActivation={() => setCurrentView('activate')}
          onGoToSetup={() => setCurrentView('setup')}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Authenticated Dashboard Router based on verified Supabase profile role / activeRoleView
  const currentRole = viewParam || activeRoleView || role || 'owner';
  const isOwnerOrAdmin = currentRole === 'owner' || currentRole === 'admin';

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#202124]">
      <Header onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)} />

      {isOwnerOrAdmin ? (
        <AdminDashboard />
      ) : currentRole === 'headmaster' || currentRole === 'assistant_headmaster' ? (
        <HeadmasterDashboard />
      ) : (
        <TeacherDashboard />
      )}

      <OfflineIndicator />

      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={() => {
          refreshSettings();
          refreshProfile();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
