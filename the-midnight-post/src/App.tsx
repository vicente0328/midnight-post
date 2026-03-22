import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { VaultProvider } from './components/VaultContext';
import VaultModal from './components/VaultModal';
import VaultAnnouncement from './components/VaultAnnouncement';
import { SoundProvider } from './components/SoundContext';
import SoundControls from './components/SoundControls';
import Layout from './components/Layout';
import { triggerDailyKnowledgeGeneration } from './services/knowledge';

const Home          = lazy(() => import('./pages/Home'));
const Envelopes     = lazy(() => import('./pages/Envelopes'));
const Archive       = lazy(() => import('./pages/Archive'));
const Library       = lazy(() => import('./pages/Library'));
const Mailbox       = lazy(() => import('./pages/Mailbox'));
const Study         = lazy(() => import('./pages/Study'));
const Account       = lazy(() => import('./pages/Account'));
const Damso         = lazy(() => import('./pages/Damso'));
const Seed          = lazy(() => import('./pages/Seed'));
const Admin         = lazy(() => import('./pages/Admin'));
const MentorLetter  = lazy(() => import('./pages/MentorLetter'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));

function AppRoutes() {
  const { isNewUser, user, markOnboarded, showGuideModal, setShowGuideModal } = useAuth();

  useEffect(() => {
    triggerDailyKnowledgeGeneration();
  }, []);

  return (
    <>
      <SoundControls />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="envelopes/:entryId" element={<Envelopes />} />
            <Route path="mailbox" element={<Mailbox />} />
            <Route path="archive" element={<Archive />} />
            <Route path="library" element={<Library />} />
            <Route path="study" element={<Study />} />
            <Route path="account" element={<Account />} />
            <Route path="seed" element={<Seed />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          {/* 담소: 전체화면 소설 인터페이스 — Layout 밖에 배치 */}
          <Route path="damso/:entryId/:mentorId" element={<Damso />} />
          {/* 멘토 먼저 보내는 편지 — 전체화면 */}
          <Route path="mentor-letter/:letterId" element={<MentorLetter />} />
        </Routes>

        {/* 신규 유저: 온보딩 자동 표시 */}
        {user && isNewUser && !showGuideModal && (
          <OnboardingModal onClose={markOnboarded} isInitial />
        )}

        {/* Guide 버튼으로 열기 (기존 유저 포함) */}
        {showGuideModal && (
          <OnboardingModal onClose={() => setShowGuideModal(false)} />
        )}
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <VaultProvider>
        <SoundProvider>
          <Router>
            <AppRoutes />
            <VaultAnnouncement />
            <VaultModal />
          </Router>
        </SoundProvider>
      </VaultProvider>
    </AuthProvider>
  );
}
