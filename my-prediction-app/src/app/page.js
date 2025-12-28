// src/app/page.js
"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Clock, TrendingUp, AlertCircle, CheckCircle, Hourglass, Plus, User } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [userBets, setUserBets] = useState({});
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    setUserId(uid);

    // 1. 获取市场 (关键修改：过滤掉 PENDING 状态的市场)
    const { data: marketData } = await supabase
      .from('markets')
      .select(`*, options (*)`)
      .neq('status', 'PENDING') // <--- 只显示已通过审核的
      .order('id', { ascending: false });
    
    setMarkets(marketData || []);
    setLoading(false);

    // 2. 获取我的下注
    if (uid) {
      const { data: betsData } = await supabase.from('bets').select('*').eq('user_id', uid);
      const betsMap = {};
      betsData?.forEach(b => {
        if(!betsMap[b.market_id]) betsMap[b.market_id] = [];
        betsMap[b.market_id].push(b);
      });
      setUserBets(betsMap);
    }
  }

  function getStatus(market) {
    const now = new Date();
    const end = new Date(market.end_time);
    
    if (market.status === 'RESOLVED') return { label: '已结算', color: 'bg-slate-700 text-slate-300', icon: <CheckCircle size={12}/> };
    if (market.status === 'DISPUTE_PHASE') return { label: '争议期', color: 'bg-red-500/20 text-red-500 animate-pulse', icon: <AlertCircle size={12}/> };
    if (now > end) return { label: '裁决中', color: 'bg-yellow-500/20 text-yellow-500', icon: <Hourglass size={12}/> };
    if (end - now < 3600000) return { label: '即将结束', color: 'bg-red-500/20 text-red-500', icon: <AlertCircle size={12}/> };
    return { label: '进行中', color: 'bg-green-500/20 text-green-500', icon: <Clock size={12}/> };
  }

  function getMyPnL(market) {
    if (market.status !== 'RESOLVED' || !userBets[market.id]) return null;
    const myBets = userBets[market.id];
    let invested = 0;
    let payout = 0;
    const totalPool = market.options.reduce((sum, o) => sum + Number(o.pool_amount), 0);
    // 注意：如果是社区市场，总池实际上是扣除5%后的，这里为了简化前端显示，只做估算
    // 实际金额以数据库 transaction 为准
    const winnerPool = market.options.find(o => o.id === market.outcome_id)?.pool_amount || 1;

    myBets.forEach(bet => {
      invested += Number(bet.amount);
      if (bet.option_id === market.outcome_id) {
        // 简单估算：(我的/赢家总) * 总池 * 0.95 (假设有费率)
        const fee = market.fee_percent || 0;
        payout += (Number(bet.amount) / winnerPool) * (totalPool * (1 - fee));
      }
    });

    const pnl = payout - invested;
    return { pnl: pnl.toFixed(2), won: pnl >= 0 };
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        
        {/* --- 头部区域：标题 + 发起按钮 --- */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              热门预测
            </h1>
            <p className="text-slate-400 text-sm">去中心化社区预测市场</p>
          </div>

          {/* 新增：发起预测按钮 */}
          <Link 
            href="/create" 
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-5 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/10 group"
          >
            <div className="bg-blue-600 rounded-full p-1 group-hover:scale-110 transition-transform">
              <Plus size={16} className="text-white"/>
            </div>
            发起新预测
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-20">加载市场数据...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map(market => {
              const totalPool = market.options.reduce((acc, opt) => acc + Number(opt.pool_amount), 0);
              const status = getStatus(market);
              const myPnL = getMyPnL(market);
              const myBetsForThis = userBets[market.id];
              const hasParticipated = myBetsForThis?.length > 0;

              const optA = market.options[0];
              const optB = market.options[1];
              const probA = totalPool > 0 && optA ? Math.round((optA.pool_amount / totalPool) * 100) : 50;

              return (
                <div key={market.id} className="group bg-slate-900 border border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all flex flex-col relative">
                  
                  {/* 非官方标签 */}
                  {!market.is_official && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="bg-purple-900/80 backdrop-blur text-purple-200 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <User size={10}/> 社区
                      </span>
                    </div>
                  )}

                  <Link href={`/market/${market.id}`} className="p-5 flex-1 relative">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${status.color}`}>
                        {status.icon} {status.label}
                      </span>
                    </div>

                    <h3 className="font-bold text-lg leading-snug mb-1 group-hover:text-blue-300 transition-colors line-clamp-2 min-h-[3.5rem]">
                      {market.question}
                    </h3>
                    
                    <div className="text-xs text-slate-500 mb-4 font-mono">
                      Vol: ${totalPool.toFixed(0)}
                    </div>

                    {myPnL && (
                      <div className={`mb-4 px-3 py-2 rounded-lg font-mono text-sm font-bold flex justify-between ${myPnL.won ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        <span>本局战绩</span>
                        <span>{myPnL.pnl > 0 ? '+' : ''}{myPnL.pnl}</span>
                      </div>
                    )}

                    <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-slate-800">
                      <div style={{ width: `${probA}%` }} className="bg-green-500"></div>
                      <div style={{ width: `${100-probA}%` }} className="bg-red-500"></div>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-green-500">{probA}% {optA?.name}</span>
                      <span className="text-red-500">{100-probA}% {optB?.name || 'Other'}</span>
                    </div>
                  </Link>

                  {!['RESOLVED', 'DISPUTE_PHASE'].includes(market.status) && (
                    <div className="p-3 bg-slate-950 border-t border-slate-800 grid grid-cols-2 gap-2">
                      {hasParticipated ? (
                        <div className="col-span-2 text-center text-xs text-yellow-500 py-2 font-bold bg-yellow-500/5 rounded border border-yellow-500/10">
                          你已下注，点击上方查看详情
                        </div>
                      ) : (
                        <>
                          <Link href={`/market/${market.id}`} className="bg-green-900/20 border border-green-900 text-green-400 hover:bg-green-600 hover:text-white hover:border-green-500 py-2 rounded text-center text-sm font-bold transition-all">
                            买入 {optA?.name}
                          </Link>
                          {optB && (
                            <Link href={`/market/${market.id}`} className="bg-red-900/20 border border-red-900 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-500 py-2 rounded text-center text-sm font-bold transition-all">
                              买入 {optB.name}
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}