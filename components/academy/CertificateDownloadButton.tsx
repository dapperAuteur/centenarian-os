'use client';

// components/academy/CertificateDownloadButton.tsx
// Dynamically imports jspdf on click so the ~200KB library doesn't land
// on the initial page bundle. Renders a branded PDF of the certificate
// matching the on-screen card in /academy/verify/[token].
//
// Plan 35. Triggered from the public verification page + (optionally)
// from a student's own completed-course entry in /academy/my-courses.

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface Props {
  studentName: string;
  courseTitle: string;
  teacherName: string;
  completedDate: string;
  verificationUrl: string;
}

export default function CertificateDownloadButton({
  studentName,
  courseTitle,
  teacherName,
  completedDate,
  verificationUrl,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();

      // Fuchsia border
      doc.setDrawColor(192, 38, 211); // fuchsia-600
      doc.setLineWidth(6);
      doc.rect(24, 24, w - 48, h - 48);
      // Inner hairline
      doc.setDrawColor(232, 121, 249); // fuchsia-400
      doc.setLineWidth(1);
      doc.rect(36, 36, w - 72, h - 72);

      // Header
      doc.setTextColor(192, 38, 211);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('CERTIFICATE OF COMPLETION', w / 2, 90, { align: 'center' });

      doc.setTextColor(17, 24, 39);
      doc.setFontSize(26);
      doc.text('CentenarianOS Academy', w / 2, 130, { align: 'center' });

      // "This certifies that"
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(11);
      doc.text('This certifies that', w / 2, 185, { align: 'center' });

      // Student name — may be long, wrap if needed.
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(28);
      const nameLines = doc.splitTextToSize(studentName, w - 160);
      doc.text(nameLines as string[], w / 2, 220, { align: 'center' });

      // "has successfully completed"
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(11);
      const afterNameY = 220 + (Array.isArray(nameLines) ? (nameLines.length - 1) * 30 : 0) + 40;
      doc.text('has successfully completed', w / 2, afterNameY, { align: 'center' });

      // Course title
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(162, 28, 175); // fuchsia-700
      doc.setFontSize(20);
      const titleLines = doc.splitTextToSize(courseTitle, w - 160);
      doc.text(titleLines as string[], w / 2, afterNameY + 36, { align: 'center' });

      // Footer row: completed + instructor
      const footerY = h - 110;
      doc.setDrawColor(229, 231, 235); // gray-200
      doc.setLineWidth(0.5);
      doc.line(80, footerY - 20, w - 80, footerY - 20);

      doc.setTextColor(156, 163, 175); // gray-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('COMPLETED', 80, footerY);
      doc.text('INSTRUCTOR', w - 80, footerY, { align: 'right' });

      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(completedDate, 80, footerY + 18);
      doc.text(teacherName, w - 80, footerY + 18, { align: 'right' });

      // Verification URL
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(8);
      doc.text('Verify at:', w / 2, h - 54, { align: 'center' });
      doc.setTextColor(192, 38, 211);
      doc.text(verificationUrl, w / 2, h - 40, { align: 'center' });

      const filename = `${studentName.replace(/\s+/g, '_')}-${courseTitle.replace(/\s+/g, '_').slice(0, 40)}-certificate.pdf`;
      doc.save(filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      className="min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Generating PDF…
        </>
      ) : (
        <>
          <Download className="w-4 h-4" aria-hidden="true" /> Download PDF
        </>
      )}
    </button>
  );
}
