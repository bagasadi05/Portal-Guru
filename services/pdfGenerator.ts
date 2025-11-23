import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Database } from './database.types';

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
    let currentY = 0;

    const addHeader = (isFirstPage = false) => {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, PAGE_WIDTH, 30, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("LAPORAN HASIL BELAJAR SISWA", PAGE_WIDTH / 2, 12, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN", PAGE_WIDTH / 2, 22, { align: 'center' });

        currentY = isFirstPage ? 40 : 35;
    };

    const addFooter = () => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);

            const footerText = `Halaman ${i} dari ${pageCount}`;
            const dateText = `Dicetak: ${new Date().toLocaleDateString('id-ID')}`;

            doc.text(footerText, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });
            doc.text(dateText, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
        }
    };

    const checkPageBreak = (requiredSpace: number) => {
        if (currentY + requiredSpace > PAGE_HEIGHT - 20) {
            doc.addPage();
            addHeader(false);
        }
    };

    const drawSectionTitle = (title: string, bgColor = false) => {
        checkPageBreak(12);

        if (bgColor) {
            doc.setFillColor(30, 41, 59);
            doc.rect(MARGIN - 2, currentY - 5, PAGE_WIDTH - (MARGIN * 2) + 4, 10, 'F');
            doc.setTextColor(255, 255, 255);
        } else {
            doc.setTextColor(30, 41, 59);
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, MARGIN, currentY);

        doc.setTextColor(30, 41, 59);
        currentY += 10;
    };

    addHeader(true);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const infoData = [
        ['Nama Siswa', ': ' + student.name],
        ['Kelas', ': ' + (student.classes?.name || 'N/A')],
        ['Tahun Ajaran', `: ${new Date().getFullYear()} / ${new Date().getFullYear() + 1}`]
    ];

    autoTable(doc, {
        startY: currentY,
        body: infoData,
        theme: 'plain',
        styles: {
            fontSize: 10,
            cellPadding: 2,
            font: 'helvetica'
        },
        columnStyles: {
            0: { cellWidth: 35, fontStyle: 'bold' },
            1: { cellWidth: 'auto' }
        },
        margin: { left: MARGIN }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    if (academicRecords.length > 0) {
        drawSectionTitle('A. Capaian Akademik', true);

        const getPredicate = (score: number) => {
            if (score >= 90) return 'A';
            if (score >= 80) return 'B';
            if (score >= 70) return 'C';
            if (score >= 60) return 'D';
            return 'E';
        };

        const groupedRecords: { [key: string]: AcademicRecordRow[] } = {};
        academicRecords.forEach(record => {
            const subject = record.subject || 'Lainnya';
            if (!groupedRecords[subject]) {
                groupedRecords[subject] = [];
            }
            groupedRecords[subject].push(record);
        });

        const academicBody: any[] = [];
        let rowNum = 1;

        Object.entries(groupedRecords).forEach(([subject, records]) => {
            records.forEach((record, index) => {
                academicBody.push([
                    rowNum++,
                    index === 0 ? subject : '',
                    record.assessment_name || '-',
                    record.score,
                    getPredicate(record.score),
                    record.notes || 'Capaian sesuai dengan nilai yang diperoleh.'
                ]);
            });
        });

        autoTable(doc, {
            startY: currentY,
            head: [['No', 'Mata Pelajaran', 'Penilaian', 'Nilai', 'Predikat', 'Deskripsi Capaian']],
            body: academicBody,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 3,
                lineColor: [229, 231, 235],
                lineWidth: 0.3,
                font: 'helvetica'
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 30 },
                2: { cellWidth: 25 },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 18, halign: 'center' },
                5: { cellWidth: 'auto' }
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: MARGIN, right: MARGIN }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    drawSectionTitle('B. Absensi & Perilaku', true);

    const attendanceSummary = attendanceRecords.reduce((acc, record) => {
        if (record.status !== 'Hadir') {
            (acc as any)[record.status] = ((acc as any)[record.status] || 0) + 1;
        }
        return acc;
    }, { Sakit: 0, Izin: 0, Alpha: 0 });

    const tableStartY = currentY;
    const tableWidth = (PAGE_WIDTH - MARGIN * 2 - 5) / 2;

    autoTable(doc, {
        startY: tableStartY,
        head: [['Ketidakhadiran']],
        body: [
            [`Sakit: ${attendanceSummary.Sakit} hari`],
            [`Izin: ${attendanceSummary.Izin} hari`],
            [`Tanpa Keterangan (Alpha): ${attendanceSummary.Alpha} hari`]
        ],
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            lineColor: [229, 231, 235],
            lineWidth: 0.3
        },
        tableWidth: tableWidth,
        margin: { left: MARGIN }
    });

    const leftTableFinalY = (doc as any).lastAutoTable.finalY;

    const violationBody = violations.length > 0
        ? violations.map(v => [`${v.description} (${v.points} poin)`])
        : [['Siswa menunjukkan sikap yang baik dan terpuji.']];

    autoTable(doc, {
        startY: tableStartY,
        head: [['Catatan Perilaku']],
        body: violationBody,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            lineColor: [229, 231, 235],
            lineWidth: 0.3
        },
        tableWidth: tableWidth,
        margin: { left: PAGE_WIDTH / 2 + 2.5 }
    });

    currentY = Math.max(leftTableFinalY, (doc as any).lastAutoTable.finalY) + 10;

    drawSectionTitle('C. Catatan Wali Kelas', true);

    const noteText = teacherNote || 'Tidak ada catatan khusus untuk semester ini.';
    const noteLines = doc.splitTextToSize(noteText, PAGE_WIDTH - MARGIN * 2 - 10);
    const noteHeight = noteLines.length * 5 + 10;

    checkPageBreak(noteHeight);

    doc.setFillColor(249, 250, 251);
    doc.rect(MARGIN, currentY, PAGE_WIDTH - MARGIN * 2, noteHeight, 'F');

    doc.setDrawColor(229, 231, 235);
    doc.rect(MARGIN, currentY, PAGE_WIDTH - MARGIN * 2, noteHeight, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(noteLines, MARGIN + 5, currentY + 7);

    currentY += noteHeight + 15;

    const signatureHeight = 40;
    checkPageBreak(signatureHeight);

    const col1X = MARGIN + 20;
    const col2X = PAGE_WIDTH - MARGIN - 60;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text('Orang Tua/Wali', col1X, currentY, { align: 'center' });

    doc.text(`Madiun, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, col2X, currentY, { align: 'center' });
    doc.text('Wali Kelas', col2X, currentY + 6, { align: 'center' });

    currentY += 30;

    doc.text('(___________________)', col1X, currentY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    const teacherName = user?.name || '___________________';
    doc.text(teacherName, col2X, currentY, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(col2X - 30, currentY - 1, col2X + 30, currentY - 1);

    addFooter();
};
