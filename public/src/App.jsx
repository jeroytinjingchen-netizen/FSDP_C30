// App.jsx - the route table. react-router-dom maps a URL path to the component shown for it.
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout.jsx';
import Centres from './pages/Centres.jsx';
import Classes from './pages/Classes.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Grading from './pages/Grading.jsx';
import Instructors from './pages/Instructors.jsx';
import Students from './pages/Students.jsx';
import Login from './pages/Login.jsx';
import Payments from './pages/Payments.jsx';
import StudentPortal from './pages/StudentPortal.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public login page */}
      <Route path="/" element={<Login />} />

      {/* Every admin page is nested in AdminLayout, which redirects to login if the user is not an admin.
          The layout renders the matching child page where it places <Outlet />. */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="centres" element={<Centres />} />
        <Route path="classes" element={<Classes />} />
        <Route path="instructors" element={<Instructors />} />
        <Route path="students" element={<Students />} />
        <Route path="grading" element={<Grading />} />
        <Route path="payments" element={<Payments />} />
      </Route>

      {/* Minimal student portal: rank, package purchase, attendance */}
      <Route path="/student" element={<StudentPortal />} />

      {/* Any unknown URL goes back to the login page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
