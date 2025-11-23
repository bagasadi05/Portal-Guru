import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Database } from './database.types';

// Define the types needed from the database
type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];

// FIX: Correct the syntax for the Pick utility type. Keys should be a union string literal.
type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };

export type ReportData = {
    student: StudentWithClass,
    reports: ReportRow[],
    attendanceRecords: AttendanceRow[],
    academicRecords: AcademicRecordRow[],
    violations: ViolationRow[],
    quizPoints: QuizPointRow[],
};

type AppUser = {
    id: string;
    email?: string;
    name: string;
    avatarUrl: string;
}

// --- NEW PROFESSIONAL PDF GENERATOR ---

export const generateStudentReport = (
    doc: jsPDF,
    reportData: ReportData,
    teacherNote: string,
    user: AppUser | null
) => {
    const { student, academicRecords, quizPoints, violations, attendanceRecords } = reportData;
    
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const MARGIN = 15;
    let y = 0;

    const addHeader = () => {
        doc.setFillColor(30, 41, 59); // gray-800
        doc.rect(0, 0, PAGE_WIDTH, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("LAPORAN HASIL BELAJAR SISWA", PAGE_WIDTH / 2, 14, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN", PAGE_WIDTH / 2, 21, { align: 'center' });
        y = 38;
    };

    const addFooter = () => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(156, 163, 175);
            doc.text(`Rapor ${student.name} - Halaman ${i} dari ${pageCount}`, MARGIN, PAGE_HEIGHT - 8);
            doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
        }
    };
    
    const checkPageBreak = (spaceNeeded: number) => {
        if (y + spaceNeeded > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            addHeader();
        }
    };

    const drawSectionHeader = (title: string) => {
        checkPageBreak(12); // Space for header and some padding
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(title, MARGIN, y);
        y += 7;
    };
    
    const tableConfig: any = {
        theme: 'grid',
        headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: [30, 41, 59], textColor: '#ffffff', fontSize: 9 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, lineColor: '#e5e7eb', lineWidth: 0.2 },
        alternateRowStyles: { fillColor: '#f9fafb' },
        didDrawPage: () => addHeader(), // Redraw header on auto-added pages
    };

    // --- 1. START DOCUMENT ---
    addHeader();
    
    // --- 2. STUDENT INFO ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Siswa', MARGIN, y); doc.text(`: ${student.name}`, MARGIN + 40, y);
    doc.text('Kelas', MARGIN, y + 6); doc.text(`: ${student.classes?.name || 'N/A'}`, MARGIN + 40, y + 6);
    y += 14;

    // --- 3. ACADEMIC RECORDS ---
    if (academicRecords.length > 0) {
        drawSectionHeader('A. Capaian Akademik');
        const getPredicate = (score: number) => {
            if (score >= 86) return 'A'; if (score >= 76) return 'B'; if (score >= 66) return 'C'; return 'D';
        };
        const academicBody = academicRecords.map((r, i) => [
            i + 1, r.subject, r.assessment_name || '-', r.score, getPredicate(r.score), r.notes || ''
        ]);
        autoTable(doc, {
            ...tableConfig,
            startY: y,
            head: [['No', 'Mata Pelajaran', 'Penilaian', 'Nilai', 'Predikat', 'Deskripsi Capaian']],
            body: academicBody,
            columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 15, halign: 'center' }, 5: { cellWidth: 'auto' } }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // --- 4. ACTIVITY POINTS ---
    if (quizPoints.length > 0) {
        drawSectionHeader('B. Catatan Keaktifan & Pengembangan Diri');
        const quizBody = quizPoints.map((r, i) => [i + 1, new Date(r.quiz_date).toLocaleDateString('id-ID'), r.quiz_name, r.subject]);
        autoTable(doc, { ...tableConfig, startY: y, head: [['No', 'Tanggal', 'Aktivitas', 'Keterangan']], body: quizBody });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // --- 5. ATTENDANCE & BEHAVIOR ---
    drawSectionHeader('C. Absensi & Perilaku');
    const attendanceSummary = attendanceRecords.reduce((acc, record) => {
        if (record.status !== 'Hadir') { (acc as any)[record.status] = ((acc as any)[record.status] || 0) + 1; }
        return acc;
    }, { Sakit: 0, Izin: 0, Alpha: 0 });
    
    autoTable(doc, {
        ...tableConfig,
        startY: y,
        head: [['Ketidakhadiran']],
        body: [
            [`Sakit: ${attendanceSummary.Sakit} hari`],
            [`Izin: ${attendanceSummary.Izin} hari`],
            [`Tanpa Keterangan: ${attendanceSummary.Alpha} hari`],
        ],
        tableWidth: (PAGE_WIDTH - MARGIN * 2) / 2 - 5,
        margin: { left: MARGIN },
    });
    const attendanceTableFinalY = (doc as any).lastAutoTable.finalY;

    const violationBody = violations.length > 0
        ? violations.map(v => [`- ${v.description} (${v.points} poin)`])
        : [['Siswa menunjukkan sikap yang baik dan terpuji.']];
    autoTable(doc, {
        ...tableConfig,
        startY: y,
        head: [['Catatan Perilaku']],
        body: violationBody,
        tableWidth: (PAGE_WIDTH - MARGIN * 2) / 2 - 5,
        margin: { left: PAGE_WIDTH / 2 + 5 },
    });
    y = Math.max(attendanceTableFinalY, (doc as any).lastAutoTable.finalY) + 10;

    // --- 6. TEACHER'S NOTE ---
    drawSectionHeader("D. Catatan Wali Kelas");
    const noteText = teacherNote || 'Tidak ada catatan khusus untuk semester ini.';
    const noteLines = doc.splitTextToSize(noteText, PAGE_WIDTH - MARGIN * 2);
    const noteHeight = noteLines.length * 5; // Approximate height
    checkPageBreak(noteHeight);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(noteLines, MARGIN, y);
    y += noteHeight + 5;

    // --- 7. SIGNATURE BLOCK ---
    const signatureBlockHeight = 45;
    checkPageBreak(signatureBlockHeight);
    const signatureX = PAGE_WIDTH - MARGIN - 70;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Madiun, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, signatureX, y); y += 6;
    doc.text('Wali Kelas,', signatureX, y); y += 25;
    doc.setFont('helvetica', 'bold');
    doc.text(user?.name || '___________________', signatureX, y);

    // --- 8. FINALIZE ---
    addFooter();
};