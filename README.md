# Skrip Migrasi SQL untuk Memperbaiki Fungsi Portal Orang Tua

Gunakan skrip SQL di bawah ini untuk memperbaiki masalah akses data di portal orang tua. Skrip ini akan dijalankan sebagai bagian dari sistem migrasi Supabase.

**Tujuan:**
1.  Menghapus fungsi PostgreSQL `get_student_portal_data` dan `verify_access_code` yang lama dan berpotensi tidak aman.
2.  Membuat kembali fungsi-fungsi tersebut dengan `SECURITY DEFINER` untuk melewati Row Level Security (RLS) secara terkendali.
3.  Menambahkan validasi keamanan di dalam fungsi `get_student_portal_data` untuk memastikan bahwa data hanya dikembalikan jika `student_id` dan `access_code` yang diberikan cocok.
4.  Mengagregasi semua data yang relevan (siswa, guru, nilai, absensi, pelanggaran, dll.) ke dalam satu struktur JSON yang diharapkan oleh aplikasi frontend.

## Skrip SQL Lengkap

Salin dan tempelkan konten berikut ke dalam file migrasi Supabase baru Anda (misalnya, `supabase/migrations/<timestamp>_fix_parent_portal_functions.sql`).

```sql
-- Hapus fungsi lama yang tidak aman terlebih dahulu untuk memastikan awal yang bersih.
DROP FUNCTION IF EXISTS public.get_student_portal_data(text, text);
DROP FUNCTION IF EXISTS public.verify_access_code(text);
DROP FUNCTION IF EXISTS public.get_student_portal_data(uuid, text);
DROP FUNCTION IF EXISTS public.verify_access_code(access_code_param text);


-- Fungsi untuk memverifikasi kode akses secara aman dan mengembalikan ID siswa.
-- Fungsi ini berjalan dengan izin dari pengguna yang membuatnya (definer),
-- memungkinkannya melewati RLS untuk pemeriksaan spesifik dan terkontrol ini.
CREATE OR REPLACE FUNCTION public.verify_access_code(access_code_param text)
RETURNS TABLE(id uuid, access_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.access_code
    FROM public.students s
    WHERE s.access_code = access_code_param
    LIMIT 1;
END;
$$;


-- Fungsi utama untuk mengambil semua data untuk portal orang tua secara aman.
-- SECURITY DEFINER digunakan untuk melewati RLS, tetapi pemeriksaan keamanan dilakukan
-- di dalam fungsi untuk memastikan pemanggil memiliki ID siswa dan kode akses yang benar.
CREATE OR REPLACE FUNCTION public.get_student_portal_data(student_id_param uuid, access_code_param text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    is_valid boolean;
BEGIN
    -- Pemeriksaan Keamanan: Verifikasi bahwa student_id dan access_code yang diberikan cocok.
    -- Ini adalah bagian paling penting dari fungsi ini.
    SELECT EXISTS (
        SELECT 1
        FROM public.students
        WHERE id = student_id_param AND access_code = access_code_param
    ) INTO is_valid;

    -- Jika kredensial tidak valid, kembalikan set kosong.
    IF NOT is_valid THEN
        RETURN;
    END IF;

    -- Jika valid, lanjutkan untuk membangun objek JSON dengan semua data yang diperlukan dan kembalikan sebagai baris.
    RETURN QUERY
    SELECT json_build_object(
        'student', json_build_object(
            'id', s.id,
            'name', s.name,
            'avatar_url', s.avatar_url,
            'user_id', s.user_id,
            'classes', json_build_object('name', c.name)
        ),
        'teacher', json_build_object(
            'user_id', u.id,
            'name', u.raw_user_meta_data->>'name',
            'avatar_url', u.raw_user_meta_data->>'avatar_url'
        ),
        'reports', COALESCE((SELECT json_agg(r ORDER BY r.date DESC) FROM public.reports r WHERE r.student_id = student_id_param), '[]'::json),
        'attendanceRecords', COALESCE((SELECT json_agg(a ORDER BY a.date DESC) FROM public.attendance a WHERE a.student_id = student_id_param), '[]'::json),
        'academicRecords', COALESCE((SELECT json_agg(ar ORDER BY ar.created_at DESC) FROM public.academic_records ar WHERE ar.student_id = student_id_param), '[]'::json),
        'violations', COALESCE((SELECT json_agg(v ORDER BY v.date DESC) FROM public.violations v WHERE v.student_id = student_id_param), '[]'::json),
        'quizPoints', COALESCE((SELECT json_agg(qp ORDER BY qp.quiz_date DESC) FROM public.quiz_points qp WHERE qp.student_id = student_id_param), '[]'::json),
        'communications', COALESCE((SELECT json_agg(cm ORDER BY cm.created_at ASC) FROM public.communications cm WHERE cm.student_id = student_id_param), '[]'::json)
    )
    FROM 
        public.students s
        LEFT JOIN public.classes c ON s.class_id = c.id
        LEFT JOIN auth.users u ON s.user_id = u.id
    WHERE 
        s.id = student_id_param;

END;
$$;

-- Catatan tentang Keamanan:
-- Menggunakan 'SECURITY DEFINER' sangat kuat. Pemeriksaan internal 'IF NOT is_valid THEN RETURN; END IF;'
-- sangat penting untuk mencegah akses data yang tidak sah. Ini memastikan bahwa meskipun fungsi
-- berjalan dengan hak istimewa yang lebih tinggi, ia hanya mengembalikan data untuk siswa yang diautentikasi.

```

### Cara Menggunakan

1.  Buat file baru di dalam direktori `supabase/migrations/` proyek Anda.
2.  Beri nama file dengan timestamp saat ini, diikuti dengan nama deskriptif. Contoh: `20240730100000_fix_parent_portal_functions.sql`.
3.  Salin seluruh konten dari blok kode SQL di atas ke dalam file baru yang Anda buat.
4.  Jalankan `supabase db push` atau terapkan migrasi melalui alur kerja Anda untuk menerapkan perubahan ke database Supabase Anda.