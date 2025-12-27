// src/app/page.js
"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '../components/Navbar';
import Link from 'next/link';
import { Clock, TrendingUp } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Home() {
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    fetchMarkets();
  }, []);

  async function fetchMarkets() {
    // 联合查询市场和选项
    const { data, error } = await supabase
      .from('markets')
      .select(`
        *,
        options (*)
      `)
      .order('id', { ascending: false });
    
    if (data) setMarkets(data);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              热门预测
            </h1>
            <p className="text-slate-400">基于真实资金的去中心化预测市场</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => {
            const totalPool = market.options.reduce((acc, opt) => acc + Number(opt.pool_amount), 0);
            const topOption = market.options.sort((a, b) => b.pool_amount - a.pool_amount)[0];
            const probability = totalPool > 0 ? Math.round((topOption?.pool_amount / totalPool) * 100) : 0;

            return (
              <Link href={`/market/${market.id}`} key={market.id} className="group bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:border-blue-500/50 hover:bg-slate-900 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-24 h-24 text-blue-500" />
                </div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <h3 className="font-bold text-lg leading-snug pr-8 group-hover:text-blue-300 transition-colors">
                    {market.question}
                  </h3>
                  <div className="text-right">
                    <div className="text-2xl font-black text-blue-400">{probability}%</div>
                    <div className="text-xs text-slate-500">概率</div>
                  </div>
                </div>

                {/* 迷你图表 (示意) */}
                <div className="h-1 w-full bg-slate-800 rounded-full mb-4 overflow-hidden">
                  <div style={{ width: `${probability}%` }} className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 
                    {new Date(market.end_time).toLocaleDateString()}
                  </span>
                  <span className="text-slate-500">Vol: ${totalPool.toFixed(0)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}