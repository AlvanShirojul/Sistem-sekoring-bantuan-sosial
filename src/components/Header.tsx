/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navLinkClasses =
  'group relative px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ease-out';
const activeLinkClasses =
  'text-white -translate-y-1 drop-shadow-[0_0_8px_rgba(134,221,208,0.38)] before:absolute before:inset-0 before:rounded-md before:bg-[var(--color-mint)]/25 before:blur-sm before:-z-10';
const inactiveLinkClasses =
  'text-[var(--color-mint)]/80 hover:text-white hover:-translate-y-1 hover:before:absolute hover:before:inset-0 hover:before:rounded-md hover:before:bg-[var(--color-mint)]/15 hover:before:blur-sm hover:before:-z-10';
const logoutButtonClasses =
  'group relative px-3 py-2 rounded-md text-sm font-medium text-[var(--color-mint)]/80 transition-all duration-300 ease-out hover:text-white hover:-translate-y-1 hover:before:absolute hover:before:inset-0 hover:before:rounded-md hover:before:bg-[var(--color-mint)]/15 hover:before:blur-sm hover:before:-z-10';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const requestLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <>
      <header className="bg-[var(--color-navy)] shadow-md mb-12 border-b border-[var(--color-mint)]/25">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-white tracking-wide">BansosApp</h1>
              </div>
              <nav className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <NavLink to="/" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}>
                    Dasbor Bantuan
                  </NavLink>
                  <NavLink to="/residents" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}>
                    Data Penduduk
                  </NavLink>
                </div>
              </nav>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <span className="text-sm font-medium text-[var(--color-mint)] mr-4">Admin User</span>
                <button
                  onClick={requestLogout}
                  className={logoutButtonClasses}
                >
                  Logout
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-[var(--color-mint)] hover:bg-[var(--color-teal-dark)] hover:text-white"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute right-0 top-0 h-full w-72 bg-[var(--color-navy)] shadow-xl p-5 border-l border-[var(--color-mint)]/25">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Menu</h2>
              <button
                type="button"
                aria-label="Tutup sidebar"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-2 text-[var(--color-mint)] hover:bg-[var(--color-teal-dark)] hover:text-white"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-2">
              <NavLink
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `${navLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}
              >
                Dasbor Bantuan
              </NavLink>
              <NavLink
                to="/residents"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `${navLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}
              >
                Data Penduduk
              </NavLink>
            </nav>

            <div className="mt-8 border-t border-[var(--color-mint)]/25 pt-4">
              <p className="text-sm font-medium text-[var(--color-mint)] mb-3">Admin User</p>
              <button
                onClick={requestLogout}
                className={`${logoutButtonClasses} w-full text-left`}
              >
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--color-mint)]/40 bg-gradient-to-br from-[var(--color-navy)] via-[var(--color-teal-dark)] to-[var(--color-teal)] p-6 shadow-2xl">
            <p className="text-sm text-[var(--color-mint)]/90">Konfirmasi</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Logout sekarang?</h3>
            <p className="mt-2 text-sm text-[var(--color-surface)]/90">
              Sesi login akan diakhiri dan Anda akan diarahkan ke halaman login.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-lg border border-[var(--color-mint)]/45 px-4 py-2 text-sm font-medium text-[var(--color-mint)] hover:bg-[var(--color-mint)]/10"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-navy)] hover:bg-[#9de8dc]"
              >
                Ya, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
