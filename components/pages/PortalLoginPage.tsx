import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';

const PortalLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const code = accessCode.trim();

    if (!code) {
        setError("Kode akses tidak boleh kosong.");
        setLoading(false);
        return;
    }

    // Use the dedicated RPC function for verifying the access code.
    // This is more secure and reliable, especially if RLS is active.
    const { data: students, error: rpcError } = await supabase
        .rpc('verify_access_code', {
            access_code_param: code
        });
    
    setLoading(false);

    if (rpcError) {
        console.error("Supabase portal login RPC error:", rpcError);
        setError("Gagal memverifikasi kode. Ini mungkin disebabkan oleh konfigurasi database (RLS/Functions). Pastikan fungsi di Supabase sudah benar.");
        return;
    }

    if (!students || students.length === 0) {
        setError("Kode akses tidak valid. Pastikan Anda memasukkan kode yang benar dari guru.");
        return;
    }
    
    if (students.length > 1) {
        // The RPC might handle this, but we add a client-side check for safety.
        setError("Ditemukan beberapa siswa dengan kode akses yang mirip. Harap hubungi guru Anda untuk kode yang unik.");
        return;
    }
    
    const student = students[0];

    // The RPC returns the correctly-cased access code from the database.
    // We must store *this* code in the session, not the user's input,
    // to ensure case-sensitive functions on the next page work correctly.
    sessionStorage.setItem('portal_access_code', student.access_code!);
    navigate(`/portal/${student.id}`);
  };


  const handleFocus = () => document.body.setAttribute('data-focused', 'true');
  const handleBlur = () => document.body.setAttribute('data-focused', 'false');

  return (
    <div className="flex items-center justify-center min-h-screen animate-page-transition">
        <div className="login-card">
            <div className="holographic-orb-container">
                <div className="holographic-orb">
                    <div className="orb-glow"></div>
                    <div className="orb-core"></div>
                    <div className="orb-ring orb-ring-1"></div>
                    <div className="orb-ring orb-ring-2"></div>
                </div>
            </div>
            
            <h1 className="form-title">Portal Siswa</h1>
            <p className="form-subtitle">
              Masukkan kode akses yang diberikan oleh guru Anda.
            </p>
            
            <form onSubmit={handleSubmit}>
                <div className="form-group-icon">
                    <input 
                        type="text" 
                        placeholder="KODE AKSES" 
                        required 
                        value={accessCode} 
                        onChange={e => setAccessCode(e.target.value.toUpperCase())} 
                        onFocus={handleFocus} 
                        onBlur={handleBlur}
                        aria-label="Kode Akses"
                        autoCapitalize="characters"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                        maxLength={6}
                        className="text-center font-bold tracking-[0.3em] uppercase"
                        style={{ paddingLeft: '15px', paddingRight: '15px' }}
                    />
                </div>
                
                {error && (
                    <p className="text-center text-sm text-yellow-300 mb-4">{error}</p>
                )}
                
                <button type="submit" className="form-btn" disabled={loading}>
                    {loading ? 'Memverifikasi...' : 'Lanjutkan'}
                </button>
            </form>
            
            <div className="text-center mt-6 border-t border-white/10 pt-4">
                 <Link to="/" className="form-links a">
                    Kembali ke pemilihan peran
                </Link>
            </div>
        </div>
    </div>
  );
};

export default PortalLoginPage;