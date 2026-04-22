import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import IntakeForm from './IntakeForm';
import Disclaimer from './Disclaimer';
import Success from './Success';
import Cancel from './Cancel';
import Login from './Login';
import SecondaryUserForm from './SecondaryUserForm';
import Dashboard from './Dashboard';
import Assessment from './Assessment';
import Report from './Report';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pre-payment flow */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/intake" element={<IntakeForm />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/success" element={<Success />} />
        <Route path="/cancel" element={<Cancel />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/secondary-user" element={<SecondaryUserForm />} />

        {/* Protected portal */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
