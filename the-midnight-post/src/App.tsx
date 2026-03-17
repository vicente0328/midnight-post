import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { SoundProvider } from './components/SoundContext';
import SoundControls from './components/SoundControls';
import Layout from './components/Layout';
import Home from './pages/Home';
import Envelopes from './pages/Envelopes';
import Archive from './pages/Archive';
import Library from './pages/Library';
import Study from './pages/Study';
import Account from './pages/Account';
import Damso from './pages/Damso';
import Seed from './pages/Seed';
import OnboardingModal from './components/OnboardingModal';
import { triggerDailyKnowledgeGeneration } from './services/knowledge';

function AppRoutes() {
  const { isNewUser, user } = useAuth();

  useEffect(() => {
    triggerDailyKnowledgeGeneration();
  }, []);

  return (
    <>
      <SoundControls />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="envelopes/:entryId" element={<Envelopes />} />
          <Route path="archive" element={<Archive />} />
          <Route path="library" element={<Library />} />
          <Route path="study" element={<Study />} />
          <Route path="account" element={<Account />} />
          <Route path="seed" element={<Seed />} />
        </Route>
        {/* 담소: 전체화면 소설 인터페이스 — Layout 밖에 배치 */}
        <Route path="damso/:entryId/:mentorId" element={<Damso />} />
      </Routes>
      {user && isNewUser && <OnboardingModal />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SoundProvider>
        <Router>
          <AppRoutes />
        </Router>
      </SoundProvider>
    </AuthProvider>
  );
}
