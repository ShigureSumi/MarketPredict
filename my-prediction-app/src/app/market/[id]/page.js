// src/app/market/[id]/page.js
"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/SuccessCheck';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, Lock } from 'lucide-react';
import SuccessCheck from '@/components/Navbar';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function MarketDetail({ params }) {
  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    fetchMarketData();
    getUser();
    
    // 倒计时逻辑
    const timer = setInterval(() => {
      if(market) calculateTimeLeft(market.end_time);
    }, 1000);
    return () => clearInterval(timer);
  }, [market?.id]); // 依赖修正

  async function fetchMarketData() {
    const { data } = await supabase
      .from('markets')
      .select(`*, options(*)`)
      .eq('id', params.id)
      .single();
    setMarket(data);
  }

  async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    }
  }

  function calculateTimeLeft(endTime) {
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) {
      setTimeLeft("已截止");
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    setTimeLeft(`${days}天 ${hours}时 ${minutes}分`);
  }

  // 模拟图表数据 (真实项目需要后端记录历史)
  const chartData = [
    { time: '00:00', prob: 20 },
    { time: '06:00', prob: 35 },
    { time: '12:00', prob: 45 },
    { time: '18:00', prob: 42 },
    { time: '现在的', prob: market ? calculateProb(market.options[0]) : 50 },
  ];

  function calculateProb(option) {
    if (!market) return 0;
    const total = market.options.reduce((acc, o) => acc + Number(o.pool_amount), 0);
    if (total === 0) return 0;
    return Math.round((option.pool_amount / total) * 100);
  }

  // 核心：下注逻辑
  const handlePlaceBet = async () => {
    if (!selectedOption || !betAmount) return;
    
    // 1. 检查条件
    if (Number(betAmount) < 50) return alert("最低下注 50 币");
    if (Number(betAmount) > profile.balance) return alert("余额不足");
    if (new Date() > new Date(market.end_time)) return alert("已截止");

    // 2. 数据库事务 (扣钱 + 加池 + 记账)
    // 注意：在前端直接调 Supabase 做事务不安全，生产环境应用 RPC。这里简化演示。
    
    // A. 扣余额
    await supabase.from('profiles').update({ balance: profile.balance - betAmount }).eq('id', user.id);
    
    // B. 加池子
    await supabase.from('options').update({ pool_amount: Number(selectedOption.pool_amount) + Number(betAmount) }).eq('id', selectedOption.id);
    
    // C. 记录下注
    await supabase.from('bets').insert({
      user_id: user.id,
      market_id: market.id,
      option_id: selectedOption.id,
      amount: betAmount
    });

    // D. 记流水
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: -betAmount,
      type: 'BET',
      description: `下注: ${market.question.substring(0, 10)}... - ${selectedOption.name}`
    });

    setBetSuccess(true);
    setTimeout(() => {
      setBetSuccess(false);
      setShowConfirm(false);
      window.location.reload();
    }, 2000);
  };

  if (!market) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">加载中...</div>;

  const totalVol = market.options.reduce((acc, o) => acc + Number(o.pool_amount), 0);
  const isClosed = new Date() > new Date(market.end_time) || market.status !== 'OPEN';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 头部信息 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {isClosed ? <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Lock size={12}/> 已截止</span> 
            : <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock size={12}/> {timeLeft}</span>}
            <span className="text-slate-500 text-sm">总量: ${totalVol.toFixed(0)}</span>
          </div>
          <h1 className="text-3xl font-black mb-4">{market.question}</h1>
          <p className="text-slate-400 text-sm p-4 bg-slate-900 rounded-xl border border-white/5 leading-relaxed">
            {market.description || "暂无详细说明..."}
          </p>
          
          {/* 裁决后显示证据 */}
          {market.status === 'RESOLVED' && (
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
              <h3 className="text-blue-400 font-bold mb-1 flex items-center gap-2"><CheckCircle size={16}/> 裁决证据</h3>
              <p className="text-sm text-slate-300">{market.evidence || "根据官方公告裁决。"}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 左侧：图表 */}
          <div className="md:col-span-2 bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase">赔率走势 (Option 1)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="time" stroke="#475569" fontSize={12} />
                  <YAxis stroke="#475569" fontSize={12} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="prob" stroke="#3b82f6" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 右侧：交易面板 */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 sticky top-24 h-fit">
            <h3 className="font-bold mb-4">进行预测</h3>
            
            {/* 选项按钮 */}
            <div className="space-y-3 mb-6">
              {market.options.map(opt => {
                const prob = calculateProb(opt);
                // 赔率 = 1 / 概率 (简化版)
                const odds = prob > 0 ? (100 / prob).toFixed(2) : "--";

                return (
                  <button
                    key={opt.id}
                    disabled={isClosed}
                    onClick={() => setSelectedOption(opt)}
                    className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all ${
                      selectedOption?.id === opt.id 
                        ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                    } ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-bold">{opt.name}</span>
                    <div className="text-right">
                      <div className={`text-sm font-mono ${selectedOption?.id === opt.id ? 'text-white' : 'text-blue-400'}`}>
                        {odds}x
                      </div>
                      <div className="text-xs opacity-50">{prob}%</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 金额输入 */}
            {selectedOption && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="relative mb-4">
                  <span className="absolute left-4 top-3.5 text-slate-500">$</span>
                  <input 
                    type="number"
                    value={betAmount}
                    onChange={e => {
                      if(Number(e.target.value) <= (profile?.balance || 0)) setBetAmount(e.target.value)
                    }}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-8 pr-4 focus:border-blue-500 outline-none font-mono text-lg"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>余额: {Number(profile?.balance).toFixed(2)}</span>
                    <button onClick={() => setBetAmount(profile?.balance)} className="text-blue-400 hover:underline">最大</button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowConfirm(true)}
                  disabled={!betAmount || Number(betAmount) < 50}
                  className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {Number(betAmount) < 50 && betAmount ? "最低 50 币" : "下注"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            {betSuccess ? (
              <div className="text-center">
                <SuccessCheck />
                <p className="font-bold text-lg mt-2">下注成功！</p>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold mb-4">确认交易</h3>
                <div className="bg-slate-950 p-4 rounded-xl mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">预测项目</span>
                    <span className="text-right truncate w-40">{market.question}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">选择方向</span>
                    <span className="text-white font-bold">{selectedOption.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">投入金额</span>
                    <span className="text-white font-mono">${betAmount}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800">
                    <span className="text-slate-400">当前赔率</span>
                    <span className="text-green-400 font-mono">
                      {(100 / calculateProb(selectedOption)).toFixed(2)}x
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700">取消</button>
                  <button onClick={handlePlaceBet} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold">确认下注</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}