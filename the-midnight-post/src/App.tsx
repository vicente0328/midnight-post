import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import { SoundProvider } from './components/SoundContext';
import SoundControls from './components/SoundControls';
import Layout from './components/Layout';
import Home from './pages/Home';
import Envelopes from './pages/Envelopes';
import Archive from './pages/Archive';

export default function App() {
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
