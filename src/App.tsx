import { Route, Routes } from 'react-router-dom';
import { AppLayout, PublicLayout } from '@/layouts/AppLayout';
import { RequireAuth, RequireGuest } from '@/components/layout/RouteGuards';
import { WelcomePage } from '@/pages/WelcomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { HomePage } from '@/pages/HomePage';
import { FamilyPage } from '@/pages/FamilyPage';
import { MyLetterPage } from '@/pages/MyLetterPage';
import { MemberLetterPage } from '@/pages/MemberLetterPage';
import { MyReservationsPage } from '@/pages/MyReservationsPage';
import { AdminPage } from '@/pages/AdminPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { JoinByLinkPage } from '@/pages/JoinByLinkPage';

export default function App() {
  return (
    <Routes>
      <Route element={<RequireGuest />}>
        <Route element={<PublicLayout />}>
          <Route path="/bienvenida" element={<WelcomePage />} />
          <Route path="/acceder" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/unirse" element={<JoinByLinkPage />} />
          <Route path="/familia/:familyId" element={<FamilyPage />} />
          <Route path="/familia/:familyId/mi-carta" element={<MyLetterPage />} />
          <Route path="/familia/:familyId/cartas/:userId" element={<MemberLetterPage />} />
          <Route path="/familia/:familyId/admin" element={<AdminPage />} />
          <Route path="/reservas" element={<MyReservationsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<PublicLayout />}>
        <Route index element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="glass p-8 text-center">
      <span className="text-5xl" aria-hidden="true">🦌</span>
      <h1 className="mt-4 text-3xl">Esta página se ha perdido por el Polo Norte</h1>
      <a href="/" className="btn-primary mt-6">Volver al inicio</a>
    </div>
  );
}
