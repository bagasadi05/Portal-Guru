
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { KeyRoundIcon } from '../Icons';

const PortalLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!accessCode.trim()) {
        setError("Kode akses tidak boleh kosong.");
        setLoading(false);
        return;
    }

    try {
        const { data: student, error: fetchError } = await supabase
            .from('students')
            .select('id')
            .eq('access_code', accessCode.trim())
            .single<{ id: string }>();

        if (fetchError || !student) {
            throw new Error("Kode akses tidak valid. Pastikan Anda memasukkan kode yang benar dari guru.");
        }

        // Store code in sessionStorage for the portal session
        sessionStorage.setItem('portal_access_code', accessCode.trim());
        
        navigate(`/portal/${student.id}`);

    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleFocus = () => document.body.setAttribute('data-focused', 'true');
  const handleBlur = () => document.body.setAttribute('data-focused', 'false');

  return (
    <div className="flex items-center justify-center min-h-screen">
        <div className="glass-container">
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
                    <KeyRoundIcon className="icon h-5 w-5" />
                    <input 
                        type="text" 
                        placeholder="Kode Akses Unik" 
                        required 
                        value={accessCode} 
                        onChange={e => setAccessCode(e.target.value)} 
                        onFocus={handleFocus} 
                        onBlur={handleBlur}
                        aria-label="Kode Akses"
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
                 <Link to="/login" className="form-links a">
                    Masuk sebagai Guru
                </Link>
            </div>
        </div>
    </div>
  );
};

export default PortalLoginPage;
