/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import ModernAlert from './components/ModernAlert';
import VerificationPage from './pages/VerificationPage';
import NewPeriodPage from './pages/NewPeriodPage';
import EditPeriodPage from './pages/EditPeriodPage';
import UploadPage from './pages/UploadPage';
import ResidentsPage from './pages/ResidentsPage';
import NewResidentPage from './pages/NewResidentPage';
import EditResidentPage from './pages/EditResidentPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResidentDetailPage from './pages/ResidentDetailPage';
import OCRUploadPage from './pages/OCRUploadPage';
import BwmConfigPage from './pages/BwmConfigPage';

const isAuthenticated = () => !!localStorage.getItem('token');

const ProtectedLayout = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      <main className="-mt-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
          {children}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [alertState, setAlertState] = useState({
    open: false,
    title: 'System Update',
    message: '',
  });

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: any) => {
      setAlertState({
        open: true,
        title: 'Notifikasi',
        message: String(message ?? ''),
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <ProtectedLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/residents" element={<ResidentsPage />} />
                <Route path="/resident/new" element={<NewResidentPage />} />
                <Route path="/resident/:id/edit" element={<EditResidentPage />} />
                <Route path="/resident/:residentId/detail" element={<ResidentDetailPage />} />
                <Route path="/beneficiary/:id" element={<VerificationPage />} />
                <Route path="/period/new" element={<NewPeriodPage />} />
                <Route path="/period/:periodId/edit" element={<EditPeriodPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/ocr-upload" element={<OCRUploadPage />} />
                <Route path="/settings/bwm" element={<BwmConfigPage />} />
              </Routes>
            </ProtectedLayout>
          }
        />
      </Routes>
      <ModernAlert
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={closeAlert}
      />
    </>
  );
}
