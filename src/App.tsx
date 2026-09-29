import { useEffect, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import BackgroundGlow from '@/components/BackgroundGlow';
import SetupNeeded from '@/components/SetupNeeded';
import { useAuthBoot } from '@/hooks/useAuthBoot';
import { detectRole, setRole } from '@/lib/device';
import { useSession } from '@/store/session';
import PhoneApp from '@/screens/phone/PhoneApp';
import TvApp from '@/screens/tv/TvApp';

function Boot() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="cc-skeleton h-10 w-56 rounded-full" />
    </div>
  );
}

function RoleLanding() {
  const navigate = useNavigate();
  useEffect(() => {
    const role = detectRole();
    navigate(role === 'tv' ? '/tv' : '/play', { replace: true });
  }, [navigate]);
  return <Boot />;
}

/** Forces `cc.role` and the TV root class for a role-specific route. */
function RoleRoute({ role, children }: { role: 'tv' | 'phone'; children: ReactElement }) {
  useEffect(() => {
    setRole(role);
    document.documentElement.classList.toggle('cc-tv', role === 'tv');
    return () => {
      document.documentElement.classList.remove('cc-tv');
    };
  }, [role]);
  return children;
}

export default function App() {
  const { state, user } = useAuthBoot();
  const init = useSession((s) => s.init);

  useEffect(() => {
    if (state === 'ready' && user) init(detectRole(), user.id);
  }, [init, state, user]);

  if (state === 'setup-needed' || state === 'missing-env') {
    return (
      <>
        <BackgroundGlow />
        <SetupNeeded />
      </>
    );
  }

  if (state === 'booting') return <Boot />;

  return (
    <>
      <BackgroundGlow />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleLanding />} />
          <Route
            path="/tv"
            element={
              <RoleRoute role="tv">
                <TvApp />
              </RoleRoute>
            }
          />
          <Route
            path="/play"
            element={
              <RoleRoute role="phone">
                <PhoneApp />
              </RoleRoute>
            }
          />
          <Route
            path="/join/:code"
            element={
              <RoleRoute role="phone">
                <PhoneApp />
              </RoleRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
