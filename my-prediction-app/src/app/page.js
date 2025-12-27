// src/app/page.js
"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Clock, TrendingUp, AlertCircle, CheckCircle, Hourglass } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [userBets, setUserBets] = useState({}); // 用对象存储: { marketId: [bets...] }
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    setUserId(uid);

    // 1. 获取市场
    const { data: marketData } = await supabase
      .from('markets')
      .select(`*, options (*)`).order('id', { ascending: false });
    
    setMarkets(marketData || []);

    // 2. 如果已登录，获取我的所有下注
    if (uid) {
      const { data: betsData } = await supabase.from('bets').select('*').eq('user_id', uid);
      // 整理成 { 1: [bet1, bet2], 2: [bet3] } 的格式方便查找
      const betsMap = {};
      betsData?.forEach(b => {
        if(!betsMap[b.market_id]) betsMap[b.market_id] = [];
        betsMap[b.market_id].push(b);
      });
      setUserBets(betsMap);
    }
  }

  // 计算状态标签
  function getStatus(market) {
    const now = new Date();
    const end = new Date(market.end_time);
    
    if (market.status === 'RESOLVED') return { label: '已结算', color: 'bg-slate-700 text-slate-300', icon: <CheckCircle size={12}/> };
    if (now > end) return { label: '裁决中', color: 'bg-yellow-500/20 text-yellow-500', icon: <Hourglass size={12}/> };
    if (end - now < 3600000) return { label: '即将结束', color: 'bg-red-500/20 text-red-500 animate-pulse', icon: <AlertCircle size={12}/> };
    return { label: '进行中', color: 'bg-green-500/20 text-green-500', icon: <Clock size={12}/> };
  }

  // 计算个人盈亏 (估算显示)
  function getMyPnL(market) {
    if (market.status !== 'RESOLVED' || !userBets[market.id]) return null;
    
    const myBets = userBets[market.id];
    let invested = 0;
    let payout = 0;
    
    // 计算总池和赢家池
    const totalPool = market.options.reduce((sum, o) => sum + Number(o.pool_amount), 0);
    const winnerPool = market.options.find(o => o.id === market.outcome_id)?.pool_amount || 1;

    myBets.forEach(bet => {
      invested += Number(bet.amount);
      if (bet.option_id === market.outcome_id) {
        // 赢了：按比例分钱
        payout += (Number(bet.amount) / winnerPool) * totalPool;
      }
    });

    const pnl = payout - invested;
    return { pnl: pnl.toFixed(2), won: pnl >= 0 };
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          热门预测
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => {
            const totalPool = market.options.reduce((acc, opt) => acc + Number(opt.pool_amount), 0);
            const status = getStatus(market);
            const myPnL = getMyPnL(market);
            const myBetsForThis = userBets[market.id];
            const hasParticipated = myBetsForThis?.length > 0;

            // 假设第一个选项是 YES/A，第二个是 NO/B
            const optA = market.options[0];
            const optB = market.options[1]; // 可能不存在
            const probA = totalPool > 0 && optA ? Math.round((optA.pool_amount / totalPool) * 100) : 50;

            return (
              <div key={market.id} className="group bg-slate-900 border border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all flex flex-col">
                {/* 卡片上半部分：点击去详情 */}
                <Link href={`/market/${market.id}`} className="p-5 flex-1 relative">
                  {/* 状态标 */}
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Vol: ${totalPool.toFixed(0)}</span>
                  </div>

                  <h3 className="font-bold text-lg leading-snug mb-4 group-hover:text-blue-300 transition-colors">
                    {market.question}
                  </h3>

                  {/* 结算后的个人盈亏 */}
                  {myPnL && (
                    <div className={`mb-4 px-3 py-2 rounded-lg font-mono text-sm font-bold flex justify-between ${myPnL.won ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      <span>本局战绩</span>
                      <span>{myPnL.pnl > 0 ? '+' : ''}{myPnL.pnl}</span>
                    </div>
                  )}

                  {/* 红绿进度条 */}
                  <div className="flex h-2 rounded-full overflow-hidden mb-2">
                    <div style={{ width: `${probA}%` }} className="bg-green-500"></div>
                    <div style={{ width: `${100-probA}%` }} className="bg-red-500"></div>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-green-500">{probA}% {optA?.name}</span>
                    <span className="text-red-500">{100-probA}% {optB?.name || '其他'}</span>
                  </div>
                </Link>

                {/* 卡片下半部分：快速操作 */}
                {!['RESOLVED', 'LOCKED'].includes(market.status) && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 grid grid-cols-2 gap-2">
                    {/* 如果已经参与，显示提示 */}
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
      </main>
    </div>
  );
}