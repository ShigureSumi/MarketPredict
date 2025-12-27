// src/app/login/page.js
"use client";
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogIn } from 'lucide-react';
import Navbar from '@/components/Navbar';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("登录失败：账号或密码错误");
      setLoading(false);
    } else {
      // 登录成功，跳转回主页
      router.push('/'); 
      router.refresh(); // 强制刷新导航栏状态
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="flex items-center justify-center p-4 h-[calc(100vh-64px)]">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500">
              <LogIn />
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-center mb-2">欢迎回来</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">登录以管理您的预测资产</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="email" 
                placeholder="邮箱地址"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <input 
                type="password" 
                placeholder="密码"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {errorMsg && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">{errorMsg}</p>}

            <button 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {loading ? <Loader2 className="animate-spin" /> : "立即登录"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            还没有账号？ <Link href="/register" className="text-blue-400 hover:underline">去注册</Link>
          </div>
        </div>
      </div>
    </div>
  );
}