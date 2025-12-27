// src/components/Navbar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// 引入了 Shield 图标用于管理员按钮
import { Zap, User, LogOut, Wallet, Shield } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // 新增：管理员状态
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // 1. 获取当前登录用户
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });
    
    // 2. 实时监听余额变化 (别人转账或下注后自动更新)
    const channel = supabase.channel('schema-db-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
      // 如果更新的是当前用户，就更新状态
      if (payload.new.id === user?.id) {
        setProfile(payload.new);
      }
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]); // 依赖修正

  async function fetchProfile(id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) {
      setProfile(data);
      // 检查是否是管理员
      setIsAdmin(data.is_admin || false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // 强制刷新跳转
  };

  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* LOGO 区域：已改名为 OCTAGON */}
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
              {/* 管理员入口：只有 isAdmin 为 true 时才显示 */}
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                >
                  <Shield className="w-3 h-3" />
                  ADMIN
                </Link>
              )}

              {/* 余额显示 */}
              <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-1.5 rounded-full border border-white/5 hover:border-blue-500/50 transition-all">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="font-mono text-white font-bold tracking-tight">
                  ${Number(profile?.balance || 0).toFixed(2)}
                </span>
              </div>

              {/* 头像/个人中心 */}
              <Link href="/profile" className="relative group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg group-hover:shadow-blue-500/20 transition-all border border-white/10">
                  {profile?.username?.[0]?.toUpperCase() || <User size={18}/>}
                </div>
              </Link>

              {/* 登出按钮 */}
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 p-2 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/login" className="px-5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                登录
              </Link>
              <Link href="/register" className="px-5 py-2 text-sm font-bold bg-white text-black rounded-full hover:bg-slate-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}