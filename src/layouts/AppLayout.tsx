import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Snowfall } from '@/components/ui/Snowfall';
import { Toaster } from '@/components/ui/Toaster';

/** Layout de páginas autenticadas. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-gold focus:px-3 focus:py-2 focus:text-pine-deep"
      >
        Saltar al contenido
      </a>
      <Snowfall />
      <Navbar />
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

/** Layout de páginas públicas (bienvenida, login, registro). */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Snowfall />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
