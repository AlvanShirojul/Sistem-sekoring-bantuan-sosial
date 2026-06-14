/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';

/**
 * Export beneficiaries data to Excel file
 * @param beneficiaries - Array of beneficiary objects to export
 * @param periodId - Period ID for filename
 */
export const exportBeneficiariesToExcel = (
  beneficiaries: any[],
  periodId: string
) => {
  const dataToExport = beneficiaries.map((b, index) => ({
    Peringkat: index + 1,
    Nama: b.name,
    Skor: b.score !== null && b.score !== undefined ? Number(b.score).toFixed(2) : '',
    Status: b.status,
    Penghasilan: b.income,
    Tanggungan: b.dependents,
    'Status Rumah': b.house_status,
    Catatan: b.notes,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Penerima Bantuan');
  const filename = `penerima_bantuan_${periodId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
