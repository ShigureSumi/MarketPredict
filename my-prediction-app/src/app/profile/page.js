// src/app/profile/page.js
"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar'; // 使用 @ 避免路径错误
import { User, Wallet, History, Edit2, Save, X, TrendingUp, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 修改用户名状态
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setUser(session.user);

    // 1. 获取个人信息
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    setProfile(profileData);
    setNewUsername(profileData?.username || '');

    // 2. 获取资金流水 (按时间倒序)
    const { data: transData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setTransactions(transData || []);

    // 3. 获取下注记录 (关联市场标题)
    const { data: betsData } = await supabase
      .from('bets')
      .select(`
        *,
        market:markets (question, status),
        option:options (name)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setBets(betsData || []);

    setLoading(false);
  }

  // 修改用户名逻辑
  async function handleUpdateUsername() {
    if (!newUsername.trim()) return;
    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id);
    
    if (error) {
      alert("修改失败，可能用户名已存在");
    } else {
      setProfile({ ...profile, username: newUsername });
      setIsEditing(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">加载数据中...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 顶部个人卡片 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold shadow-lg shadow-blue-500/20">
              {profile?.username?.[0]?.toUpperCase() || <User />}
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input 
                      className="bg-slate-950 border border-slate-700 rounded px-3 py-1 text-white focus:border-blue-500 outline-none"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                    />
                    <button onClick={handleUpdateUsername} className="p-2 bg-green-600 rounded hover:bg-green-500"><Save size={16}/></button>
                    <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-700 rounded hover:bg-slate-600"><X size={16}/></button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-black">{profile?.username || '匿名用户'}</h1>
                    <button onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-blue-400">
                      <Edit2 size={16} />
                    </button>
                  </>
                )}
              </div>
              <p className="text-slate-400 text-sm font-mono">{user?.email}</p>
            </div>
          </div>

          <div className="bg-slate-950/50 p-6 rounded-xl border border-white/5 min-w-[200px] text-right">
            <div className="text-slate-400 text-sm mb-1 flex items-center justify-end gap-2"><Wallet size={14}/> 总资产</div>
            <div className="text-3xl font-mono font-bold text-green-400">${Number(profile?.balance).toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左侧：下注记录 */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
              <TrendingUp className="text-blue-500" /> 下注历史
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[300px]">
              {bets.length === 0 ? (
                <div className="p-8 text-center text-slate-500">暂无下注记录</div>
              ) : (
                bets.map(bet => (
                  <div key={bet.id} className="p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-sm text-slate-300 line-clamp-1 flex-1 mr-4">
                        {bet.market?.question}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${bet.market?.status === 'OPEN' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                        {bet.market?.status === 'OPEN' ? '进行中' : '已结束'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">选择: <span className="text-white font-medium">{bet.option?.name}</span></span>
                      <span className="font-mono text-slate-200">投入: ${bet.amount}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右侧：资金流水 */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
              <History className="text-purple-500" /> 资产变动明细
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[300px]">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">暂无资金记录</div>
              ) : (
                transactions.map(t => (
                  <div key={t.id} className="p-4 border-b border-slate-800 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${t.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {t.amount > 0 ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{t.description || '资金变动'}</div>
                        <div className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className={`font-mono font-bold ${t.amount > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}