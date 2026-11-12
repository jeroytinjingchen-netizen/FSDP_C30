import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout.jsx';
import Centres from './pages/Centres.jsx';
import Classes from './pages/Classes.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';
import Grading from './pages/Grading.jsx';
import Instructors from './pages/Instructors.jsx';
import Login from './pages/Login.jsx';
import Payments from './pages/Payments.jsx';
import Terms from './pages/Terms.jsx';
import Venues from './pages/Venues.jsx';
import StudentPortal from './pages/StudentPortal.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="centres" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="centres" element={<Centres />} />
        <Route path="venues" element={<Venues />} />
        <Route path="terms" element={<Terms />} />
        <Route path="instructors" element={<Instructors />} />
        <Route path="classes" element={<Classes />} />
        <Route path="grading" element={<Grading />} />
        <Route path="payments" element={<Payments />} />
      </Route>
      <Route path="/student" element={<StudentPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
