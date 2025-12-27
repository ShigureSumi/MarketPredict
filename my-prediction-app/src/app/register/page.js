"use client";
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
// 下面这一行是重点，用了 @ 符号
import SuccessCheck from '@/components/SuccessCheck';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        {success ? (
          <div className="text-center">
            <SuccessCheck />
            <h2 className="text-2xl font-bold text-white mb-2">注册成功</h2>
            <p className="text-slate-400 mb-6">请前往邮箱点击验证链接以激活账户。</p>
            <Link href="/login" className="text-blue-400 hover:text-blue-300">返回登录</Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-black text-white mb-6 tracking-tight">创建账户</h1>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">邮箱</label>
                <input 
                  type="email" 
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <label className="block text-slate-400 text-sm mb-1">密码</label>
                <input 
                  type={showPwd ? "text" : "password"} 
                  required
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-9 text-slate-500 hover:text-white"
                >
                  {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {errorMsg && <p className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{errorMsg}</p>}

              <button 
                disabled={loading}
                className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-slate-200 transition-all flex justify-center items-center gap-2"
              >
                {loading && <Loader2 className="animate-spin" />}
                注册
              </button>
            </form>
            <div className="mt-6 text-center text-sm text-slate-500">
              已有账号？ <Link href="/login" className="text-blue-400 hover:underline">去登录</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}