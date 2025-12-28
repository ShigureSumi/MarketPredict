// src/app/register/page.js
"use client";
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'; // 引入 Mail 图标增加视觉提示
import Link from 'next/link';
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
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl transition-all duration-300">
        
        {success ? (
          // --- 注册成功后的界面 ---
          <div className="text-center animate-in fade-in zoom-in duration-300">
            {/* 1. 绿色对号动画 */}
            <SuccessCheck />
            
            <h2 className="text-2xl font-black text-white mb-6">注册申请已提交</h2>

            {/* 2. 新增的提醒框 */}
            <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-6 mb-8 relative overflow-hidden">
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Mail size={48} />
              </div>

              <h3 className="text-blue-400 font-bold mb-2 flex items-center justify-center gap-2">
                <Mail size={18} /> 验证步骤
              </h3>
              
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                请前往您的邮箱查看邮件，并点击其中的 <span className="text-white font-bold bg-blue-600/20 px-1 rounded">认证链接 (Verify)</span>。
              </p>
              
              <p className="text-slate-500 text-xs border-t border-slate-700/50 pt-3">
                认证成功后，您即可使用账号密码登录。
                <br/>
                (点击邮件中的按钮后可能会跳转空白页，请忽略)
              </p>
            </div>

            {/* 3. 返回登录按钮 */}
            <Link 
              href="/login" 
              className="block w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
            >
              我已了解，去登录
            </Link>
          </div>
        ) : (
          // --- 注册表单 (保持不变) ---
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