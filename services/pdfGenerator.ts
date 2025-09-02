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

const getPredicate = (score: number): { predikat: string; deskripsi: string; } => {
    if (score >= 86) return { predikat: 'A', deskripsi: 'Menunjukkan penguasaan materi yang sangat baik.' };
    if (score >= 76) return { predikat: 'B', deskripsi: 'Menunjukkan penguasaan materi yang baik.' };
    if (score >= 66) return { predikat: 'C', deskripsi: 'Menunjukkan penguasaan materi yang cukup.' };
    return { predikat: 'D', deskripsi: 'Memerlukan bimbingan lebih lanjut.' };
};

export const generateStudentReport = (
    doc: jsPDF,
    reportData: ReportData,
    teacherNote: string,
    user: AppUser | null
) => {
    const { student, academicRecords, quizPoints, violations, attendanceRecords } = reportData;
    
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 0; // Will be set after header

    // --- HELPER FUNCTIONS ---
    const addHeader = () => {
        doc.setFillColor(79, 70, 229); // indigo-600
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text("LAPORAN HASIL BELAJAR SISWA", pageWidth / 2, 14, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text("MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN", pageWidth / 2, 20, { align: 'center' });
        y = 38;
    };
    
    const addFooter = () => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(156, 163, 175);
            doc.text(`Rapor ${student.name} - Halaman ${i} dari ${pageCount}`, margin, pageHeight - 8);
            doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }
    };
    
    // --- REPORT GENERATION START ---
    addHeader();
    
    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const studentInfoY = y;
    doc.text('Nama Siswa', margin, studentInfoY); doc.text(`: ${student.name}`, margin + 30, studentInfoY);
    y += 6;
    doc.text('Kelas', margin, y); doc.text(`: ${student.classes?.name || 'N/A'}`, margin + 30, y);
    y += 7;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const tableTheme: any = {
        theme: 'grid',
        headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: [79, 70, 229], textColor: '#ffffff', fontSize: 9 },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, lineColor: '#d1d5db', lineWidth: 0.5 },
        didDrawPage: (data: any) => {
            // Re-add header on new pages
            if (data.pageNumber > 1) {
                addHeader();
            }
        }
    };

    // Academic Records
    if (academicRecords.length > 0) {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('A. Capaian Akademik', margin, y); y += 6;
        const academicBody = academicRecords.map((r, i) => {
            const predicateInfo = getPredicate(r.score);
            return [i + 1, r.subject, r.score, predicateInfo.predikat, r.notes || predicateInfo.deskripsi];
        });
        autoTable(doc, {
            startY: y,
            head: [['No', 'Mata Pelajaran', 'Nilai', 'Predikat', 'Deskripsi Capaian Kompetensi']],
            body: academicBody,
            ...tableTheme,
            columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 12 }, 3: { cellWidth: 15 }, 4: { cellWidth: 'auto' } }
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }
    
    // Non-Academic / Activity Records
    if (quizPoints.length > 0) {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('B. Catatan Keaktifan & Pengembangan Diri', margin, y); y += 6;
        const quizBody = quizPoints.map((r, i) => [i + 1, new Date(r.quiz_date).toLocaleDateString('id-ID'), r.quiz_name, r.subject]);
        autoTable(doc, {
            startY: y,
            head: [['No', 'Tanggal', 'Kegiatan/Aktivitas', 'Keterangan']],
            body: quizBody,
            ...tableTheme
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Attendance & Violations
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('C. Absensi & Perilaku', margin, y); y += 6;

    const attendanceSummary = attendanceRecords.reduce((acc, record) => {
        if (record.status !== 'Hadir') { (acc as any)[record.status] = ((acc as any)[record.status] || 0) + 1; }
        return acc;
    }, { Sakit: 0, Izin: 0, Alpha: 0 });
    
    autoTable(doc, {
        startY: y,
        head: [['Ketidakhadiran']],
        body: [
            [`Sakit: ${attendanceSummary.Sakit} hari`],
            [`Izin: ${attendanceSummary.Izin} hari`],
            [`Tanpa Keterangan: ${attendanceSummary.Alpha} hari`],
        ],
        ...tableTheme,
        styles: { ...tableTheme.styles, fontSize: 8 },
        tableWidth: (pageWidth - margin * 2) / 2 - 5,
        margin: { left: margin },
    });
    const attendanceTableFinalY = (doc as any).lastAutoTable.finalY;
    
    const violationBody = violations.length > 0
        ? violations.map(v => [`- ${v.description} (${v.points} poin)`])
        : [['Siswa menunjukkan sikap yang baik dan terpuji.']];
    
    autoTable(doc, {
        startY: y,
        head: [['Catatan Perilaku']],
        body: violationBody,
        ...tableTheme,
        styles: { ...tableTheme.styles, fontSize: 8 },
        tableWidth: (pageWidth - margin * 2) / 2 - 5,
        margin: { left: pageWidth / 2 + 5 },
    });
    const behaviorTableFinalY = (doc as any).lastAutoTable.finalY;
    y = Math.max(attendanceTableFinalY, behaviorTableFinalY) + 8;


    // Teacher's Note with justification
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('D. Catatan Wali Kelas', margin, y); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const noteText = teacherNote || 'Tidak ada catatan.';
    const noteLines = doc.splitTextToSize(noteText, pageWidth - margin * 2);
    doc.text(noteLines, margin, y, { align: 'justify', maxWidth: pageWidth - margin * 2 });
    y += noteLines.length * 4; // Adjust spacing based on line height
    
    // Signature block
    // Check if there is enough space, if not, reduce spacing before drawing.
    if (y > pageHeight - 50) {
        y = pageHeight - 50; // Force it higher if it's about to overflow
    } else {
        y += 10;
    }
    
    const signatureX = pageWidth - margin - 60;
    doc.setFontSize(9);
    doc.text(`Madiun, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, signatureX, y, { align: 'left' }); y += 5;
    doc.text('Wali Kelas,', signatureX, y, { align: 'left' }); y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text(user?.name || '___________________', signatureX, y, { align: 'left' });
    doc.setFont('helvetica', 'normal');
    
    addFooter();
};
