import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

const LOG_MESSAGES = [
  "Sinkronisasi data keuangan...",
  "Memeriksa anomali pada absensi lapangan...",
  "Menghitung estimasi sisa BBM...",
  "Memvalidasi riwayat transaksi...",
  "Menganalisis tren operasional...",
  "Memindai database untuk duplikasi...",
  "Mengamankan koneksi SSL...",
  "Menghubungkan ke node server pusat...",
  "Memproses antrian tugas latar belakang..."
];

export default function AILiveLogs() {
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [status, setStatus] = useState<'working' | 'done'>('working');
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString('id-ID', { hour12: false }));

  useEffect(() => {
    // Initial status
    let isMounted = true;
    
    const runCycle = () => {
      if (!isMounted) return;
      setTimeStr(new Date().toLocaleTimeString('id-ID', { hour12: false }));
      setStatus('working');
      
      setTimeout(() => {
        if (!isMounted) return;
        setStatus('done');
      }, 1500);
    };
    
    runCycle();
    const interval = setInterval(() => {
      setCurrentLogIndex(prev => (prev + 1) % LOG_MESSAGES.length);
      runCycle();
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mt-2 flex items-center gap-2 text-[10px] sm:text-xs font-mono text-indigo-200/60 bg-slate-950/40 px-2.5 py-1 rounded border border-indigo-500/10 w-fit backdrop-blur-sm">
      <Activity className="w-3 h-3 animate-pulse text-indigo-400/80" />
      <span>{`> [${timeStr}] ${LOG_MESSAGES[currentLogIndex]}`}</span>
      <span className={`font-bold ml-1 ${status === 'working' ? 'text-amber-400/80 animate-pulse' : 'text-emerald-400/80'}`}>
        {status === 'working' ? '...' : 'OK'}
      </span>
    </div>
  );
}
