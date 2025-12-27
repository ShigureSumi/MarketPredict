// src/components/Navbar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, User, LogOut, Wallet } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });
    
    // 监听余额变化（比如下注后）
    const channel = supabase.channel('schema-db-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
      setProfile(payload.new);
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchProfile(id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    setProfile(data);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          <Zap className="text-blue-500 fill-blue-500" /> POLYCLONE
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-1.5 rounded-full border border-white/5 hover:border-blue-500/50 transition-all">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="font-mono text-white font-bold">${Number(profile?.balance).toFixed(2)}</span>
              </div>
              <Link href="/profile" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white">
                  {profile?.username?.[0]?.toUpperCase()}
                </div>
              </Link>
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-400">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/login" className="px-5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                登录
              </Link>
              <Link href="/register" className="px-5 py-2 text-sm font-bold bg-white text-black rounded-full hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                注册账号
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}