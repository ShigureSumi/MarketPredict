// src/app/market/[id]/page.js
"use client";
import { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, Lock, Clock, Trash2, Gavel, Loader2, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SuccessCheck from '@/components/SuccessCheck';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function MarketDetail({ params }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const router = useRouter();

  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  
  // 状态控制
  const [showConfirm, setShowConfirm] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState('');
  const [userBets, setUserBets] = useState([]); // 存储用户下注记录
  const [evidence, setEvidence] = useState('');

  // 这里的 loading 状态很重要，防止数据没加载出来时用户就点击了
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (id) {
      // 同时获取市场数据和用户数据，确保同步
      Promise.all([fetchMarketData(), getUser()]).then(() => {
        setDataLoading(false);
      });

      const timer = setInterval(() => {
        setMarket(prev => {
           if(prev?.end_time) calculateTimeLeft(prev.end_time);
           return prev;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [id]);

  async function fetchMarketData() {
    const { data } = await supabase.from('markets').select(`*, options(*)`).eq('id', id).single();
    setMarket(data);
    if(data?.end_time) calculateTimeLeft(data.end_time);
  }

  async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
      // 关键：获取该用户在此市场的所有下注
      const { data: bets } = await supabase.from('bets').select('*').eq('market_id', id).eq('user_id', session.user.id);
      setUserBets(bets || []);
    }
  }

  function calculateTimeLeft(endTime) {
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) { setTimeLeft("已截止"); return; }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    setTimeLeft(`${days}天 ${hours}时 ${minutes}分`);
  }

  const chartData = [
    { time: 'Start', prob: 50 },
    { time: 'Now', prob: market && market.options && market.options.length > 0 ? calculateProb(market.options[0]) : 50 },
  ];

  function calculateProb(option) {
    if (!market || !market.options) return 0;
    const total = market.options.reduce((acc, o) => acc + Number(o.pool_amount), 0);
    if (total === 0) return 0;
    return Math.round((option.pool_amount / total) * 100);
  }

  // --- 核心逻辑更新：下注 ---
  const handlePlaceBet = async () => {
    if (isSubmitting) return; 

    // 1. 双重保险：再次检查用户是否已经下过注
    if (userBets.length > 0) {
      alert("规则限制：您已经参与过此预测，不可加注或反投！");
      setShowConfirm(false);
      return;
    }

    if (!selectedOption || !betAmount) return;
    if (Number(betAmount) < 1) return alert("最低下注 1 币");
    if (Number(betAmount) > (profile?.balance || 0)) return alert("余额不足");
    if (new Date() > new Date(market.end_time)) return alert("已截止");

    setIsSubmitting(true);

    try {
      await supabase.from('profiles').update({ balance: profile.balance - betAmount }).eq('id', user.id);
      await supabase.from('options').update({ pool_amount: Number(selectedOption.pool_amount) + Number(betAmount) }).eq('id', selectedOption.id);
      await supabase.from('bets').insert({
        user_id: user.id, market_id: market.id, option_id: selectedOption.id, amount: betAmount
      });
      await supabase.from('transactions').insert({
        user_id: user.id, amount: -betAmount, type: 'BET', description: `下注: ${market.question}`
      });

      setBetSuccess(true);
      setTimeout(() => {
        setBetSuccess(false);
        setShowConfirm(false);
        setIsSubmitting(false);
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error(error);
      alert("下注失败，请重试");
      setIsSubmitting(false);
    }
  };

  const handleDeleteMarket = async () => {
    if(!confirm("确定要删除这个市场吗？")) return;
    await supabase.from('markets').delete().eq('id', id);
    router.push('/');
  };

  const handleResolveMarket = async (optionId) => {
    if(!evidence) return alert("裁决必须提供证据说明！");
    if(!confirm("确定裁决并派奖？")) return;
    
    if(isSubmitting) return;
    setIsSubmitting(true);

    const { error } = await supabase.rpc('resolve_market_and_payout', {
      p_market_id: market.id,
      p_winner_option_id: optionId,
      p_evidence: evidence
    });

    if (error) {
        alert("裁决失败: " + error.message);
        setIsSubmitting(false);
    } else {
      alert("裁决完成");
      window.location.reload();
    }
  };

  if (!market || dataLoading) return <div className="min-h-screen bg-slate-950 text-white flex justify-center items-center"><Loader2 className="animate-spin" /></div>;

  const totalVol = market.options ? market.options.reduce((acc, o) => acc + Number(o.pool_amount), 0) : 0;
  const isClosed = new Date() > new Date(market.end_time) || market.status !== 'OPEN';
  
  // 计算用户已下注信息
  const hasParticipated = userBets.length > 0;
  const myTotalBet = userBets.reduce((acc, b) => acc + Number(b.amount), 0);
  const myBetOptionId = hasParticipated ? userBets[0].option_id : null;
  const myBetOptionName = hasParticipated ? market.options.find(o => o.id === myBetOptionId)?.name : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 relative">
          {profile?.is_admin && (
            <button onClick={handleDeleteMarket} className="absolute top-0 right-0 p-2 text-red-500 hover:bg-red-900/20 rounded-lg">
              <Trash2 size={20}/>
            </button>
          )}

          <div className="flex items-center gap-3 mb-4">
            {isClosed ? <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Lock size={12}/> {market.status === 'RESOLVED' ? '已结算' : '等待裁决'}</span> 
            : <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock size={12}/> {timeLeft}</span>}
            <span className="text-slate-500 text-sm">池子: ${totalVol.toFixed(0)}</span>
          </div>

          <h1 className="text-3xl font-black mb-4">{market.question}</h1>
          <p className="text-slate-400 text-sm p-4 bg-slate-900 rounded-xl border border-white/5">{market.description}</p>
          
          {market.status === 'RESOLVED' && (
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
              <h3 className="text-blue-400 font-bold mb-1 flex items-center gap-2"><CheckCircle size={16}/> 裁决证据</h3>
              <p className="text-sm text-slate-300">{market.evidence}</p>
            </div>
          )}

          {/* 如果已参与，显示锁定提示条 */}
          {hasParticipated && (
            <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-400/10 p-4 rounded-xl border border-green-400/20 animate-in slide-in-from-top-2">
              <ShieldCheck size={20}/>
              <div>
                <p className="text-sm font-bold">已锁定预测</p>
                <p className="text-xs opacity-80">你已押注 [{myBetOptionName}] ${myTotalBet}。根据规则，不可更改或加注。</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase">概率走势</h3>
            <div className="h-64 w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" stroke="#475569" fontSize={12}/>
                    <YAxis stroke="#475569" fontSize={12} unit="%"/>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                    <Line type="monotone" dataKey="prob" stroke="#3b82f6" dot={false} strokeWidth={2}/>
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Loader2 className="animate-spin"/>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 sticky top-24 h-fit">
            <h3 className="font-bold mb-4">
              {hasParticipated ? "我的预测" : "选择方向"}
            </h3>

            {/* 选项列表 */}
            <div className="space-y-3 mb-6">
              {market.options?.map(opt => {
                const prob = calculateProb(opt);
                // 逻辑：
                // 1. 如果已参与，只有我买的那个亮，其他变暗且不可点
                // 2. 如果没参与，正常显示，选中变亮
                
                const isMyChoice = hasParticipated && opt.id === myBetOptionId;
                const isDisabled = isClosed || (hasParticipated && !isMyChoice);

                // 颜色计算
                let borderClass = 'border-slate-800';
                if (!hasParticipated && !isClosed) borderClass += ' hover:border-blue-500';
                
                // 如果是我选的，或者我正在选的
                const isActive = (hasParticipated && isMyChoice) || (!hasParticipated && selectedOption?.id === opt.id);
                
                if (isActive) borderClass = 'bg-slate-800 border-white';
                else borderClass = 'bg-slate-950 border-slate-800';

                // 特殊颜色条
                let barColor = 'bg-blue-500';
                if (market.options.length === 2) {
                   if(opt.id === market.options[0].id) barColor = 'bg-green-500';
                   else barColor = 'bg-red-500';
                }

                return (
                  <button 
                    key={opt.id} 
                    disabled={isDisabled} 
                    onClick={() => !hasParticipated && setSelectedOption(opt)}
                    className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all relative overflow-hidden ${borderClass} ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 opacity-10 ${barColor}`} style={{width: `${prob}%`}}></div>
                    <span className="font-bold relative z-10 flex items-center gap-2">
                      {opt.name}
                      {isMyChoice && <CheckCircle size={14} className="text-green-400"/>}
                    </span>
                    <div className="text-right relative z-10">
                      <div className="text-sm font-mono text-white">{(100 / (prob || 1)).toFixed(2)}x</div>
                      <div className="text-xs opacity-50">{prob}%</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 下注区域 / 锁定状态区域 */}
            {hasParticipated ? (
              // 状态A: 已参与，显示锁定信息
              <div className="bg-slate-950 rounded-xl p-4 text-center border border-slate-800">
                <Lock className="mx-auto text-slate-500 mb-2" size={24}/>
                <p className="text-slate-400 text-xs">下注已锁定</p>
                <p className="text-white font-mono font-bold text-lg mt-1">${myTotalBet}</p>
              </div>
            ) : (
              // 状态B: 未参与，显示下注输入框
              selectedOption && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} placeholder="金额 (Min 1)" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 mb-4 outline-none text-white font-mono"/>
                  <button onClick={() => setShowConfirm(true)} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200">下注 ${betAmount}</button>
                </div>
              )
            )}
            
            {/* 管理员裁决 */}
            {profile?.is_admin && !isClosed && (
                <div className="mt-8 pt-6 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-red-500 mb-2 flex gap-1"><Gavel size={12}/> 管理员强制裁决</h4>
                    <input value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="输入裁决证据/理由..." className="w-full text-xs bg-slate-950 border border-slate-700 p-2 rounded mb-2"/>
                    <div className="grid grid-cols-2 gap-2">
                        {market.options.map(opt => (
                            <button key={opt.id} disabled={isSubmitting} onClick={() => handleResolveMarket(opt.id)} className="text-xs bg-slate-800 hover:bg-green-600 text-white p-2 rounded border border-slate-700 flex justify-center">
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4"/> : `判 ${opt.name} 赢`}
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            {betSuccess ? <SuccessCheck /> : (
              <>
                <h3 className="text-xl font-bold mb-4">确认下注</h3>
                <p className="text-slate-400 text-sm mb-4">方向: <span className="text-white font-bold">{selectedOption.name}</span><br/>金额: <span className="text-white">${betAmount}</span></p>
                <div className="flex gap-3">
                  <button 
                    disabled={isSubmitting} 
                    onClick={() => setShowConfirm(false)} 
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handlePlaceBet} 
                    disabled={isSubmitting} 
                    className="flex-1 py-3 rounded-xl bg-blue-600 font-bold hover:bg-blue-500 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "确认支付"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}