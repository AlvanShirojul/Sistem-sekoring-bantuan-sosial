/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import BeneficiaryDashboard from './BeneficiaryDashboard';

const Stats = lazy(() => import('./Stats'));

/**
 * Main Dashboard Component
 * Displays beneficiary data with statistics
 * Separates beneficiary management logic into BeneficiaryDashboard component
 */
export default function Dashboard() {
  const [allBeneficiaries, setAllBeneficiaries] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // Fetch beneficiaries when period changes (passed from BeneficiaryDashboard via callback)
  const handleBeneficiariesUpdate = (beneficiaries, periodId) => {
    setAllBeneficiaries(beneficiaries);
    setSelectedPeriod(periodId);
  };

  return (
    <>
      {/* Beneficiary Dashboard - Handles all beneficiary-related operations */}
      <BeneficiaryDashboard onBeneficiariesUpdate={handleBeneficiariesUpdate} />
      
      {/* Statistics section - Shows stats for current beneficiaries */}
      <Suspense fallback={<div className="mt-12 p-6 bg-slate-50 rounded-xl text-center text-slate-500">Memuat statistik...</div>}>
        <Stats data={allBeneficiaries} />
      </Suspense>
    </>
  );
}
