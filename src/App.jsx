

import { Routes, Route, Navigate } from 'react-router-dom';
import Share from './routes/Share';
import Main from './routes/Main';

export default function App() {
  return (
    <Routes>
      {/* Silent redirect route for PWA share-target */}
      <Route path="/share" element={<Share />} />

      {/* Main UI */}
      <Route path="/" element={<Main />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
