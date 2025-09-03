# Skrip Migrasi SQL untuk Fungsi Portal Orang Tua

Gunakan skrip SQL di bawah ini untuk memperbaiki masalah akses data dan mengaktifkan fungsionalitas pengiriman pesan di portal orang tua. Skrip ini akan dijalankan sebagai bagian dari sistem migrasi Supabase.

**Tujuan:**
1.  Menghapus semua versi fungsi `get_student_portal_data`, `verify_access_code`, dan `send_parent_message` yang lama dan berpotensi konflik.
2.  Membuat kembali fungsi-fungsi tersebut dengan `SECURITY DEFINER` untuk melewati Row Level Security (RLS) secara terkendali.
3.  Menambahkan validasi keamanan di dalam fungsi `get_student_portal_data` untuk memastikan bahwa data hanya dikembalikan jika `student_id` dan `access_code` yang diberikan cocok.
4.  Menambahkan fungsi `send_parent_message` baru yang secara aman memungkinkan orang tua/siswa mengirim pesan dengan memverifikasi `student_id` dan `access_code` sebelum melakukan penyisipan.
5.  Mengagregasi semua data yang relevan (siswa, guru, nilai, absensi, pelanggaran, dll.) ke dalam satu struktur JSON yang diharapkan oleh aplikasi frontend.


## Skrip SQL Lengkap

Salin dan tempelkan konten berikut ke dalam file migrasi Supabase baru Anda (misalnya, `supabase/migrations/<timestamp>_fix_parent_portal_functions_v3.sql`).

```sql
-- Hapus semua fungsi lama yang berpotensi konflik untuk memastikan awal yang bersih.
-- Ini mengatasi galat "could not choose best candidate function" dengan menghapus semua definisi yang ambigu.
DROP FUNCTION IF EXISTS public.get_student_portal_data(uuid, text);
DROP FUNCTION IF EXISTS public.get_student_portal_data(text, uuid);
DROP FUNCTION IF EXISTS public.get_student_portal_data(text, text); -- Menjaga untuk kompatibilitas mundur
DROP FUNCTION IF EXISTS public.verify_access_code(text);
DROP FUNCTION IF EXISTS public.send_parent_message(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.apply_quiz_points_to_grade(uuid, text, uuid);
-- Tambahkan fungsi baru untuk dihapus jika ada
DROP FUNCTION IF EXISTS public.update_parent_message(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.delete_parent_message(uuid, text, uuid);


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

-- Fungsi baru untuk memungkinkan orang tua/siswa mengirim pesan dari portal.
-- Fungsi ini juga menggunakan SECURITY DEFINER untuk melewati RLS secara aman setelah memverifikasi
-- identitas pemanggil melalui student_id dan access_code yang cocok.
CREATE OR REPLACE FUNCTION public.send_parent_message(
    student_id_param uuid,
    access_code_param text,
    message_param text,
    teacher_user_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_valid boolean;
BEGIN
    -- Pemeriksaan Keamanan: Verifikasi bahwa student_id dan access_code yang diberikan cocok.
    SELECT EXISTS (
        SELECT 1
        FROM public.students
        WHERE id = student_id_param AND access_code = access_code_param
    ) INTO is_valid;

    -- Jika kredensial tidak valid, lemparkan pengecualian untuk menghentikan operasi.
    IF NOT is_valid THEN
        RAISE EXCEPTION 'Invalid student ID or access code provided';
    END IF;

    -- Jika valid, lakukan penyisipan pesan ke dalam tabel komunikasi.
    -- 'user_id' di sini adalah ID guru, untuk menautkan percakapan dengan benar.
    INSERT INTO public.communications (student_id, user_id, message, sender, is_read)
    VALUES (student_id_param, teacher_user_id_param, message_param, 'parent', false);
END;
$$;

-- Fungsi baru untuk menerapkan poin keaktifan ke nilai mata pelajaran.
-- SECURITY DEFINER untuk memungkinkan operasi lintas tabel (update academic_records, delete quiz_points)
-- dalam satu transaksi atomik, sambil tetap memeriksa kepemilikan data.
CREATE OR REPLACE FUNCTION public.apply_quiz_points_to_grade(
    student_id_param uuid,
    subject_param text,
    user_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_points int;
    target_record_id uuid;
BEGIN
    -- 1. Validasi: Pastikan pengguna yang memanggil adalah pemilik data siswa.
    IF NOT EXISTS (
        SELECT 1 FROM public.students
        WHERE id = student_id_param AND user_id = user_id_param
    ) THEN
        RAISE EXCEPTION 'Izin ditolak: Anda bukan pemilik data siswa ini.';
    END IF;

    -- 2. Hitung total poin keaktifan yang tersedia untuk siswa.
    SELECT COUNT(*)
    INTO total_points
    FROM public.quiz_points
    WHERE student_id = student_id_param AND user_id = user_id_param;

    -- 3. Jika tidak ada poin, keluar dari fungsi tanpa melakukan apa-apa.
    IF total_points = 0 THEN
        RETURN;
    END IF;

    -- 4. Temukan catatan akademik terbaru untuk mata pelajaran yang ditentukan.
    SELECT ar.id
    INTO target_record_id
    FROM public.academic_records ar
    WHERE ar.student_id = student_id_param
      AND ar.subject = subject_param
      AND ar.user_id = user_id_param
    ORDER BY ar.created_at DESC
    LIMIT 1;

    -- 5. Jika tidak ada catatan akademik untuk mata pelajaran tersebut, lemparkan galat.
    IF target_record_id IS NULL THEN
        RAISE EXCEPTION 'Tidak ditemukan catatan akademik untuk mata pelajaran yang dipilih.';
    END IF;

    -- 6. Perbarui skor, pastikan tidak melebihi 100.
    UPDATE public.academic_records
    SET score = LEAST(100, score + total_points)
    WHERE id = target_record_id;

    -- 7. Hapus semua poin keaktifan yang telah digunakan untuk siswa ini.
    DELETE FROM public.quiz_points
    WHERE student_id = student_id_param AND user_id = user_id_param;

END;
$$;


-- Fungsi baru untuk memungkinkan orang tua/siswa MEMPERBARUI pesan mereka sendiri dari portal.
-- Verifikasi keamanan dilakukan sebelum pembaruan.
CREATE OR REPLACE FUNCTION public.update_parent_message(
    student_id_param uuid,
    access_code_param text,
    message_id_param uuid,
    new_message_param text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Pemeriksaan Keamanan: Verifikasi bahwa pemanggil memiliki akses ke siswa ini
    -- DAN bahwa pesan tersebut milik siswa ini dan dikirim oleh orang tua.
    IF NOT EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.communications c ON s.id = c.student_id
        WHERE s.id = student_id_param
          AND s.access_code = access_code_param
          AND c.id = message_id_param
          AND c.sender = 'parent'
    ) THEN
        RAISE EXCEPTION 'Izin ditolak atau pesan tidak ditemukan.';
    END IF;

    -- Jika valid, perbarui pesan.
    UPDATE public.communications
    SET message = new_message_param
    WHERE id = message_id_param;
END;
$$;


-- Fungsi baru untuk memungkinkan orang tua/siswa MENGHAPUS pesan mereka sendiri dari portal.
-- Verifikasi keamanan dilakukan sebelum penghapusan.
CREATE OR REPLACE FUNCTION public.delete_parent_message(
    student_id_param uuid,
    access_code_param text,
    message_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Pemeriksaan Keamanan: Sama seperti pembaruan, verifikasi kepemilikan.
    IF NOT EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.communications c ON s.id = c.student_id
        WHERE s.id = student_id_param
          AND s.access_code = access_code_param
          AND c.id = message_id_param
          AND c.sender = 'parent'
    ) THEN
        RAISE EXCEPTION 'Izin ditolak atau pesan tidak ditemukan.';
    END IF;

    -- Jika valid, hapus pesan.
    DELETE FROM public.communications
    WHERE id = message_id_param;
END;
$$;

-- Catatan tentang Keamanan:
-- Menggunakan 'SECURITY DEFINER' sangat kuat. Pemeriksaan internal 'IF NOT is_valid THEN RETURN; END IF;'
-- sangat penting untuk mencegah akses data yang tidak sah. Ini memastikan bahwa meskipun fungsi
-- berjalan dengan hak istimewa yang lebih tinggi, ia hanya mengembalikan data untuk siswa yang diautentikasi.
```

### Cara Menggunakan

1.  Buat file baru di dalam direktori `supabase/migrations/` proyek Anda.
2.  Beri nama file dengan timestamp saat ini, diikuti dengan nama deskriptif. Contoh: `20240730100000_fix_parent_portal_functions_v3.sql`.
3.  Salin seluruh konten dari blok kode SQL di atas ke dalam file baru yang Anda buat.
4.  Jalankan `supabase db push` atau terapkan migrasi melalui alur kerja Anda untuk menerapkan perubahan ke database Supabase Anda.