// src/app/market/[id]/page.js
"use client";
import { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, Lock, Clock, Trash2, Gavel, Loader2, ShieldCheck, Scale, AlertOctagon, User } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SuccessCheck from '@/components/SuccessCheck';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function MarketDetail({ params }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const router = useRouter();

  // --- 数据状态 ---
  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userBets, setUserBets] = useState([]); 
  
  // --- UI/交互状态 ---
  const [selectedOption, setSelectedOption] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [evidence, setEvidence] = useState(''); // 证据输入框

  // --- 争议投票状态 ---
  const [hasVotedDispute, setHasVotedDispute] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (id) {
      Promise.all([fetchMarketData(), getUser()]);
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
      // 获取下注记录
      const { data: bets } = await supabase.from('bets').select('*').eq('market_id', id).eq('user_id', session.user.id);
      setUserBets(bets || []);
      // 获取争议投票记录
      const { data: votes } = await supabase.from('dispute_votes').select('*').eq('market_id', id).eq('user_id', session.user.id);
      if (votes && votes.length > 0) setHasVotedDispute(true);
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

  // --- 核心逻辑 1: 普通用户下注 ---
  const handlePlaceBet = async () => {
    if (isSubmitting) return; 

    // A. 发起人禁止下注
    if (market.creator_id === user.id) {
      return alert("规则限制：你是此市场的发起人/庄家，不能参与投注！");
    }

    // B. 单边下注检查
    if (userBets.length > 0) {
      alert("规则限制：您已参与过此预测，不可加注或反投！");
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
      await supabase.from('bets').insert({ user_id: user.id, market_id: market.id, option_id: selectedOption.id, amount: betAmount });
      await supabase.from('transactions').insert({ user_id: user.id, amount: -betAmount, type: 'BET', description: `下注: ${market.question}` });
      setBetSuccess(true);
      setTimeout(() => { setBetSuccess(false); setShowConfirm(false); setIsSubmitting(false); window.location.reload(); }, 2000);
    } catch (error) {
      console.error(error); alert("下注失败"); setIsSubmitting(false);
    }
  };

  // --- 核心逻辑 2: 发起人质押裁决 ---
  const handleCreatorResolve = async (optionId) => {
    if (!evidence) return alert("必须提供证据链接或说明！");
    const confirmMsg = `⚠️ 风险提示 ⚠️\n\n您正在发起裁决。根据社区规则：\n1. 系统将【扣除并锁定您当前的全部余额】作为信用质押。\n2. 进入3天争议期。\n3. 若被社区否决，质押金将被没收！\n\n若无异议，3天后您将获得 5% 奖池分红。\n\n确定继续吗？`;
    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    const { error } = await supabase.rpc('resolve_by_creator', {
      p_market_id: market.id, p_outcome_id: optionId, p_evidence: evidence
    });
    if (error) { alert("提交失败: " + error.message); setIsSubmitting(false); }
    else { alert("裁决已提交，进入争议公示期。"); window.location.reload(); }
  };

  // --- 核心逻辑 3: 参与者投反对票 ---
  const handleDisputeVote = async () => {
    if (!confirm("确定要投反对票吗？\n如果超过半数参与者反对，发起人的质押金将被扣除，市场将被重置。")) return;
    setIsSubmitting(true);
    const { error } = await supabase.rpc('vote_dispute', { p_market_id: market.id });
    if (error) { alert(error.message); setIsSubmitting(false); }
    else { alert("反对票已记录！"); window.location.reload(); }
  };

  // --- 核心逻辑 4: 触发最终结算 (3天后) ---
  const handleFinalize = async () => {
    setIsSubmitting(true);
    const { data, error } = await supabase.rpc('finalize_creator_market', { p_market_id: market.id });
    alert(data || error.message);
    window.location.reload();
  };

  // --- 管理员特权逻辑 ---
  const handleAdminDelete = async () => {
    if(!confirm("管理员操作：确定删除？")) return;
    await supabase.from('markets').delete().eq('id', id);
    router.push('/');
  };
  const handleAdminResolve = async (optId) => {
    if(!confirm("管理员操作：强制裁决？这将跳过质押和争议期。")) return;
    const { error } = await supabase.rpc('resolve_market_and_payout', { p_market_id: market.id, p_winner_option_id: optId, p_evidence: evidence || "管理员强制裁决" });
    if(error) alert(error.message); else window.location.reload();
  };

  // --- 辅助计算 ---
  if (!market) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-white"/></div>;

  const totalVol = market.options ? market.options.reduce((acc, o) => acc + Number(o.pool_amount), 0) : 0;
  const isClosed = new Date() > new Date(market.end_time) || market.status !== 'OPEN';
  const hasParticipated = userBets.length > 0;
  const myTotalBet = userBets.reduce((acc, b) => acc + Number(b.amount), 0);
  const myBetOptionId = hasParticipated ? userBets[0].option_id : null;
  const isCreator = user && market.creator_id === user.id;
  const isDisputePhase = market.status === 'DISPUTE_PHASE';
  
  // 图表数据
  const calculateProb = (option) => {
    const total = market.options.reduce((acc, o) => acc + Number(o.pool_amount), 0);
    return total === 0 ? 0 : Math.round((option.pool_amount / total) * 100);
  };
  const chartData = [{ time: 'Start', prob: 50 }, { time: 'Now', prob: market.options.length > 0 ? calculateProb(market.options[0]) : 50 }];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* 顶部状态栏 */}
        <div className="mb-8 relative">
          {/* 管理员删除按钮 */}
          {profile?.is_admin && (
            <button onClick={handleAdminDelete} className="absolute top-0 right-0 p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors" title="管理员删除">
              <Trash2 size={20}/>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* 状态徽章 */}
            {market.status === 'RESOLVED' && <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> 已结算</span>}
            {market.status === 'OPEN' && (isClosed 
              ? <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Lock size={12}/> 等待裁决</span>
              : <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock size={12}/> {timeLeft}</span>
            )}
            {market.status === 'DISPUTE_PHASE' && <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> 争议挑战期</span>}
            
            <span className="text-slate-500 text-sm font-mono">Pool: ${totalVol.toFixed(0)}</span>
            
            {/* 非官方标签 */}
            {!market.is_official && (
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                <User size={12}/> 社区发行
              </span>
            )}
          </div>

          <h1 className="text-3xl font-black mb-4">{market.question}</h1>
          <p className="text-slate-400 text-sm p-4 bg-slate-900 rounded-xl border border-white/5">{market.description}</p>
          
          {/* 结算证据展示 */}
          {(market.status === 'RESOLVED' || market.status === 'DISPUTE_PHASE') && (
            <div className="mt-4 p-4 bg-blue-900/10 border border-blue-500/30 rounded-xl">
              <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2 text-sm"><Scale size={16}/> 发起人提交的证据</h3>
              <p className="text-sm text-slate-300 bg-slate-950 p-3 rounded border border-white/5">{market.evidence}</p>
            </div>
          )}

          {/* 用户已下注提示 */}
          {hasParticipated && (
            <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-400/10 p-4 rounded-xl border border-green-400/20">
              <ShieldCheck size={20}/>
              <div>
                <p className="text-sm font-bold">已锁定预测</p>
                <p className="text-xs opacity-80">你已押注 [{market.options.find(o=>o.id===myBetOptionId)?.name}] ${myTotalBet}。不可更改。</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 左侧图表 */}
          <div className="md:col-span-2 bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase">概率走势</h3>
            <div className="h-64 w-full">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}><XAxis dataKey="time"/><YAxis unit="%"/><Tooltip contentStyle={{backgroundColor:'#0f172a'}}/><Line type="monotone" dataKey="prob" stroke="#3b82f6" dot={false}/></LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 右侧：多功能操作面板 (核心逻辑) */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 sticky top-24 h-fit">
            
            {/* 情况A：争议挑战期 (所有人可见) */}
            {isDisputePhase ? (
              <div className="space-y-4">
                <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-center">
                  <AlertOctagon className="mx-auto text-red-500 mb-2" size={32}/>
                  <h3 className="font-bold text-red-500">正在进行结果公示</h3>
                  <p className="text-xs text-slate-400 mt-1">发起人已提交结果。如果你认为结果造假，请在3天内投反对票。</p>
                </div>
                
                {/* 如果是参与者且没投过票，显示反对按钮 */}
                {!hasVotedDispute ? (
                  <button 
                    onClick={handleDisputeVote} 
                    disabled={isSubmitting}
                    className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                     <Gavel size={16}/> 投反对票 (质疑结果)
                  </button>
                ) : (
                  <div className="text-center text-xs text-slate-500 bg-slate-950 p-2 rounded">你已提交反对票</div>
                )}

                {/* 结算检查按钮 */}
                <button onClick={handleFinalize} className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded text-xs font-mono text-slate-400">
                  检查是否满3天并结算
                </button>
              </div>
            ) : market.status === 'OPEN' ? (
              // 情况B：进行中 (OPEN)
              <>
                {isCreator ? (
                  // B-1: 发起人视角 (不能买，只能判)
                  <div className="space-y-4">
                    <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl text-center">
                      <User className="mx-auto text-purple-400 mb-2" size={24}/>
                      <h3 className="font-bold text-purple-400">发起人控制台</h3>
                      <p className="text-xs text-slate-400 mt-1">你不能参与下注。等待事件结束后，请在此提交裁决。</p>
                    </div>
                    
                    <div className="border-t border-slate-800 pt-4">
                      <label className="text-xs font-bold text-slate-500 block mb-2">提交裁决证据</label>
                      <input 
                        value={evidence} 
                        onChange={e => setEvidence(e.target.value)} 
                        placeholder="新闻链接或官方公告..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm mb-3"
                      />
                      <p className="text-[10px] text-yellow-500/80 mb-2">注意：提交裁决将质押你所有余额。若结果被社区否决，余额将被扣除。</p>
                      <div className="grid grid-cols-2 gap-2">
                        {market.options.map(opt => (
                          <button 
                            key={opt.id} 
                            onClick={() => handleCreatorResolve(opt.id)}
                            disabled={isSubmitting}
                            className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-2 rounded font-bold"
                          >
                            判 {opt.name} 赢
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  // B-2: 普通用户视角 (正常下注)
                  <>
                    <h3 className="font-bold mb-4">{hasParticipated ? "我的预测" : "选择方向"}</h3>
                    <div className="space-y-3 mb-6">
                      {market.options?.map(opt => {
                        const prob = calculateProb(opt);
                        const isMyChoice = hasParticipated && opt.id === myBetOptionId;
                        const isDisabled = isClosed || (hasParticipated && !isMyChoice);
                        let borderClass = (!hasParticipated && selectedOption?.id === opt.id) || isMyChoice ? 'bg-slate-800 border-white' : 'bg-slate-950 border-slate-800';
                        if(!hasParticipated) borderClass += ' hover:border-blue-500';

                        return (
                          <button key={opt.id} disabled={isDisabled} onClick={() => !hasParticipated && setSelectedOption(opt)} className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all relative overflow-hidden ${borderClass} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            <div className="absolute left-0 top-0 bottom-0 opacity-10 bg-blue-500" style={{width: `${prob}%`}}></div>
                            <span className="font-bold relative z-10 flex items-center gap-2">{opt.name} {isMyChoice && <CheckCircle size={14} className="text-green-400"/>}</span>
                            <div className="text-right relative z-10"><div className="text-sm font-mono text-white">{(100/(prob||1)).toFixed(2)}x</div><div className="text-xs opacity-50">{prob}%</div></div>
                          </button>
                        )
                      })}
                    </div>
                    {/* 下注输入框 */}
                    {!hasParticipated && selectedOption && (
                      <div className="animate-in fade-in slide-in-from-bottom-4">
                        <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} placeholder="金额 (Min 1)" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 mb-4 outline-none text-white font-mono"/>
                        <button onClick={() => setShowConfirm(true)} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200">下注 ${betAmount}</button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              // 情况C: 已结算 (RESOLVED)
              <div className="text-center py-10 text-slate-500">
                <CheckCircle size={48} className="mx-auto mb-4 opacity-20"/>
                <p>市场已结束</p>
                <p className="text-xs mt-2">赢家选项: {market.options.find(o => o.id === market.outcome_id)?.name}</p>
              </div>
            )}

            {/* 管理员上帝模式 (始终可见) */}
            {profile?.is_admin && market.status !== 'RESOLVED' && (
              <div className="mt-8 pt-6 border-t border-red-900/30">
                <h4 className="text-xs font-bold text-red-500 mb-2 flex gap-1"><ShieldCheck size={12}/> 管理员特权 (无视规则)</h4>
                <div className="grid grid-cols-2 gap-2">
                   {market.options.map(opt => (
                     <button key={opt.id} onClick={() => handleAdminResolve(opt.id)} className="text-[10px] bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-900/50 p-1 rounded">
                       强判 {opt.name} 赢
                     </button>
                   ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* 确认下注弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            {betSuccess ? <SuccessCheck /> : (
              <>
                <h3 className="text-xl font-bold mb-4">确认下注</h3>
                <p className="text-slate-400 text-sm mb-4">方向: <span className="text-white font-bold">{selectedOption.name}</span><br/>金额: <span className="text-white">${betAmount}</span></p>
                <div className="flex gap-3">
                  <button disabled={isSubmitting} onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50">取消</button>
                  <button onClick={handlePlaceBet} disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-blue-600 font-bold hover:bg-blue-500 flex justify-center items-center gap-2 disabled:opacity-50">
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