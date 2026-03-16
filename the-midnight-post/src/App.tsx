import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import { SoundProvider } from './components/SoundContext';
import SoundControls from './components/SoundControls';
import Layout from './components/Layout';
import Home from './pages/Home';
import Envelopes from './pages/Envelopes';
import Archive from './pages/Archive';
import { triggerDailyKnowledgeGeneration } from './services/knowledge';

export default function App() {
  useEffect(() => {
    // 오늘 첫 방문 시 현자들의 지식 DB를 백그라운드에서 자동 보충
    triggerDailyKnowledgeGeneration();
  }, []);

  return (
    <AuthProvider>
      <SoundProvider>
        <Router>
          <SoundControls />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="envelopes/:entryId" element={<Envelopes />} />
              <Route path="archive" element={<Archive />} />
            </Route>
          </Routes>
        </Router>
      </SoundProvider>
    </AuthProvider>
  );
}
