import { Routes, Route, Navigate } from 'react-router-dom';
import Share from './routes/Share';

export default function App() {
  return (
    <Routes>
      <Route path="/share" element={<Share />} />
      <Route path="*" element={<Navigate to="/share" replace />} />
    </Routes>
  );
}
