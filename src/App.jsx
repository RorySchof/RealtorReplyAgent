

import { Routes, Route, Navigate } from 'react-router-dom';
import Share from './routes/Share';
import Main from './routes/Main';
import ManualInput from './pages/ManualInput';

export default function App() {
  return (
    <Routes>
      {/* Silent redirect route for PWA share-target */}
      <Route path="/share" element={<Share />} />

      {/* Main UI */}
      <Route path="/" element={<Main />} />

      {/* Manual paste input */}
      <Route path="/manual-input" element={<ManualInput />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
