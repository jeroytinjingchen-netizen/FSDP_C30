// AdminLayout.jsx - the admin shell: sidebar on large screens, a slide-out menu on phones.
import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { CentreProvider } from '../CentreContext.jsx';
import { BuildingIcon, CalendarIcon, CheckCircleIcon, LogOutIcon, MapPinIcon, MenuIcon, XIcon } from './Icons.jsx';
import { cn } from './ui.jsx';

// Sidebar links. 'icon' is a component from Icons.jsx drawn next to the label.
const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: CheckCircleIcon },
  { to: '/admin/centres', label: 'Centres', icon: BuildingIcon },
  { to: '/admin/classes', label: 'Classes', icon: CalendarIcon },
  { to: '/admin/instructors', label: 'Instructors', icon: MapPinIcon },
  { to: '/admin/students', label: 'Students', icon: CheckCircleIcon },
  { to: '/admin/grading', label: 'Grading', icon: CheckCircleIcon },
  { to: '/admin/payments', label: 'Payments', icon: CheckCircleIcon },
];

// Brand: the logo and name at the top of the sidebar.
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/aikido-shinjukai-logo.png" alt="Aikido Shinjukai logo" className="size-9 rounded-lg object-cover" />
      <div className="leading-tight">
        <p className="font-semibold text-white">Aikido Shinjukai</p>
        <p className="text-xs text-sidebar-foreground">Admin console</p>
      </div>
    </div>
  );
}

// SidebarContent: the menu (NavLink highlights the current page) and the Log out button.
function SidebarContent({ onLogout, onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-sidebar-foreground hover:bg-sidebar-active hover:text-white'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-10 flex-1 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-active hover:text-white"
          >
            <LogOutIcon size={18} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// AdminLayout: the frame around every admin page. Logged-out users and students are sent to the login page.
// <Outlet /> is where the current page (Dashboard, Centres, ...) is drawn.
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // While the mobile menu is open, Escape closes it. The cleanup function removes the listener.
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    // Close the mobile menu whenever the page changes.
    setOpen(false);
  }, [location.pathname]);

  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />;

  return (
    <CentreProvider>
      <div className="min-h-screen bg-background lg:pl-64">
        <aside className="fixed inset-y-0 left-0 hidden w-64 bg-sidebar lg:block">
          <SidebarContent onLogout={logout} />
        </aside>

        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-sidebar px-4 lg:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex size-10 items-center justify-center rounded-lg text-white transition-colors duration-200 hover:bg-sidebar-active"
          >
            <MenuIcon />
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="animate-fade-in absolute inset-0 bg-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
            <aside id="mobile-nav" className="animate-fade-in absolute inset-y-0 left-0 w-72 max-w-[85%] bg-sidebar">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-active hover:text-white"
              >
                <XIcon size={18} />
              </button>
              <SidebarContent onLogout={logout} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </CentreProvider>
  );
}

