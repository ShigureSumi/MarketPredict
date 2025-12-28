// src/components/Navbar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, User, LogOut, Wallet, Shield, Gift } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false); // 签到loading状态

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });
    
    const channel = supabase.channel('schema-db-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
      if (payload.new.id === user?.id) setProfile(payload.new);
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  async function fetchProfile(id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) {
      setProfile(data);
      setIsAdmin(data.is_admin || false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // --- 新增：签到逻辑 ---
  const handleDailyCheckIn = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    
    // 调用数据库里写好的函数
    const { data, error } = await supabase.rpc('daily_checkin_bonus');
    
    if (error) {
      alert("签到出错: " + error.message);
    } else {
      // 成功了显示 "签到成功"，如果今天签过了显示 "今天已签到"
      alert(data);
      // 刷新余额
      if(user) fetchProfile(user.id);
    }
    setCheckingIn(false);
  };

  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter group">
          <div className="p-1.5 bg-blue-600 rounded-lg group-hover:bg-blue-500 transition-colors">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">
            OCTAGON
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">
                  <Shield className="w-3 h-3" /> ADMIN
                </Link>
              )}

              {/* 每日签到按钮 */}
              <button 
                onClick={handleDailyCheckIn}
                disabled={checkingIn}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-3 py-1.5 rounded-full border border-orange-500/30 hover:border-orange-400 transition-all text-orange-400 hover:text-white hover:from-orange-600 hover:to-yellow-600"
                title="每日签到领 100 币"
              >
                <Gift className={`w-4 h-4 ${checkingIn ? 'animate-bounce' : ''}`} />
                <span className="text-xs font-bold hidden md:inline">签到</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-1.5 rounded-full border border-white/5 hover:border-blue-500/50 transition-all">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="font-mono text-white font-bold tracking-tight">
                  ${Number(profile?.balance || 0).toFixed(2)}
                </span>
              </div>

              <Link href="/profile" className="relative group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg group-hover:shadow-blue-500/20 transition-all border border-white/10">
                  {profile?.username?.[0]?.toUpperCase() || <User size={18}/>}
                </div>
              </Link>

              <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 p-2 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/login" className="px-5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">登录</Link>
              <Link href="/register" className="px-5 py-2 text-sm font-bold bg-white text-black rounded-full hover:bg-slate-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">注册</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}