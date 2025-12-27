"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Zap, Trophy, Shield, LogOut, TrendingUp } from "lucide-react";

// --- 配置区域 ---
// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  // --- 状态变量 (就像游戏的存档) ---
  const [session, setSession] = useState(null); // 当前登录用户
  const [profile, setProfile] = useState(null); // 用户详细信息(余额/身份)
  const [markets, setMarkets] = useState([]);   // 所有的赌局
  
  // 输入框的状态
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newQuestion, setNewQuestion] = useState(""); 

  // --- 1. 页面加载时运行 ---
  useEffect(() => {
    // 检查是否已经登录
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    fetchMarkets(); // 加载市场列表
    return () => subscription.unsubscribe();
  }, []);

  // --- 2. 获取数据的函数 ---
  async function fetchProfile(userId) {
    // 从 profiles 表里查这个人的余额
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) setProfile(data);
  }

  async function fetchMarkets() {
    // 从 markets 表里查所有赌局，按ID倒序排
    const { data } = await supabase.from("markets").select("*").order("id", { ascending: false });
    if (data) setMarkets(data);
  }

  // --- 3. 登录与注册 ---
  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("登录失败: " + error.message);
  }

  async function handleSignUp() {
    // 注册账号
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert("注册出错: " + error.message);
    } else {
      alert("注册成功！送了你1000积分，请直接点击登录按钮。");
    }
  }

  // --- 4. 下注功能 ---
  async function placeBet(marketId, direction) {
    if (!profile) return alert("请先登录");
    if (profile.balance < 100) return alert("余额不足！穷鬼！");

    const betAmount = 100; // 为了简单，每次固定赌100块

    // A. 扣钱
    const { error: balanceErr } = await supabase
      .from("profiles")
      .update({ balance: profile.balance - betAmount })
      .eq("id", profile.id);
    
    if (balanceErr) return alert("扣钱失败，请重试");

    // B. 增加池子奖金 (查出当前市场数据)
    const market = markets.find(m => m.id === marketId);
    const updateData = direction === "YES" 
      ? { yes_pool: Number(market.yes_pool) + betAmount }
      : { no_pool: Number(market.no_pool) + betAmount };

    await supabase.from("markets").update(updateData).eq("id", marketId);

    // C. 记录你的下注
    await supabase.from("bets").insert({
      user_id: profile.id,
      market_id: marketId,
      direction: direction,
      amount: betAmount
    });

    alert(`成功在 ${direction} 下注 ${betAmount}！`);
    // 刷新数据
    fetchProfile(profile.id);
    fetchMarkets();
  }

  // --- 5. 管理员创建市场 ---
  async function createMarket() {
    if (!profile?.is_admin) return;
    const { error } = await supabase.from("markets").insert({
      question: newQuestion,
      end_time: new Date("2025-12-31"), // 默认时间
      yes_pool: 0,
      no_pool: 0
    });
    if (!error) {
      setNewQuestion("");
      fetchMarkets(); // 刷新列表
    } else {
      alert("创建失败: " + error.message);
    }
  }

  // --- 6. 管理员裁决 ---
  async function resolveMarket(marketId, outcome) {
    if (!profile?.is_admin) return;
    
    await supabase.from("markets").update({ 
      is_resolved: true, 
      outcome: outcome 
    }).eq("id", marketId);

    alert("裁决完成！已锁定状态。");
    fetchMarkets();
  }

  // --- 7. 界面显示 (HTML部分) ---
  
  // 如果没登录，显示登录界面
  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white p-4">
        <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl border border-gray-800">
          <div className="flex justify-center mb-6">
            <Zap className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">FUTURES</h1>
          <p className="text-gray-400 text-center mb-8">输入任意邮箱和密码即可玩</p>
          
          <div className="space-y-4">
            <input className="w-full bg-black border border-gray-700 p-3 rounded text-white" 
              placeholder="邮箱 (例如: user@test.com)" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="w-full bg-black border border-gray-700 p-3 rounded text-white" 
              type="password" placeholder="密码 (至少6位)" value={password} onChange={e => setPassword(e.target.value)} />
            <div className="flex gap-4">
              <button onClick={handleLogin} className="flex-1 bg-blue-600 py-3 rounded font-bold hover:bg-blue-500">登录</button>
              <button onClick={handleSignUp} className="flex-1 bg-gray-700 py-3 rounded hover:bg-gray-600">注册领币</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 登录后的界面
  return (
    <div className="min-h-screen bg-black text-gray-200 pb-20 font-sans">
      {/* 顶部导航 */}
      <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <Zap className="text-blue-500" /> FUTURES
          </div>
          <div className="flex items-center gap-4">
            {profile?.is_admin && <span className="text-xs bg-purple-600 px-2 py-1 rounded text-white">ADMIN</span>}
            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="font-mono text-white font-bold">{Number(profile?.balance || 0).toFixed(0)}</span>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="p-2 hover:bg-gray-800 rounded-full"><LogOut className="w-5 h-5"/></button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* 管理员控制台 (只有管理员能看到) */}
        {profile?.is_admin && (
          <div className="mb-8 p-6 bg-gray-900 rounded-xl border border-purple-900">
            <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5"/> 管理员发布预测
            </h2>
            <div className="flex gap-2">
              <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                placeholder="输入问题，例如：2026年春节会在2月吗？"
                className="flex-1 bg-black border border-gray-700 rounded px-4 py-2 text-white" />
              <button onClick={createMarket} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded font-bold text-white">发布</button>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><TrendingUp /> 热门市场</h2>

        {/* 市场列表循环 */}
        <div className="space-y-6">
          {markets.map(market => {
            const totalPool = Number(market.yes_pool) + Number(market.no_pool) + 0.0001; 
            const yesPercent = Math.round((Number(market.yes_pool) / totalPool) * 100);

            return (
              <div key={market.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition-all">
                <div className="p-6">
                  {/* 标题 */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-white">{market.question}</h3>
                    {market.is_resolved ? (
                      <span className={`px-3 py-1 rounded text-xs font-bold ${market.outcome ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                        {market.outcome ? "YES 赢" : "NO 赢"}
                      </span>
                    ) : (
                      <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs">进行中</span>
                    )}
                  </div>

                  {/* 进度条 */}
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>YES {yesPercent}%</span>
                    <span>NO {100 - yesPercent}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex mb-6">
                    <div style={{ width: `${yesPercent}%` }} className="bg-blue-500"></div>
                    <div style={{ width: `${100 - yesPercent}%` }} className="bg-red-500"></div>
                  </div>

                  {/* 按钮区域 */}
                  {!market.is_resolved ? (
                    <div className="flex gap-3">
                      <button onClick={() => placeBet(market.id, 'YES')} 
                        className="flex-1 bg-blue-500/10 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-blue-400 py-3 rounded-lg font-medium transition-all">
                        买入 YES
                      </button>
                      <button onClick={() => placeBet(market.id, 'NO')}
                        className="flex-1 bg-red-500/10 hover:bg-red-600 hover:text-white border border-red-500/30 text-red-400 py-3 rounded-lg font-medium transition-all">
                        买入 NO
                      </button>
                    </div>
                  ) : (
                    <div className="text-center p-2 bg-black rounded text-gray-500 text-sm">已结束</div>
                  )}

                  {/* 管理员裁决按钮 */}
                  {profile?.is_admin && !market.is_resolved && (
                    <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end items-center gap-3">
                      <span className="text-xs text-gray-500 font-bold uppercase">裁判操作:</span>
                      <button onClick={() => resolveMarket(market.id, true)} className="text-xs bg-gray-800 text-green-400 px-3 py-1 rounded border border-gray-700 hover:bg-green-900">判 YES 赢</button>
                      <button onClick={() => resolveMarket(market.id, false)} className="text-xs bg-gray-800 text-red-400 px-3 py-1 rounded border border-gray-700 hover:bg-red-900">判 NO 赢</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {markets.length === 0 && (
            <div className="text-center text-gray-500 py-10">暂无预测，等待管理员发布...</div>
          )}
        </div>
      </main>
    </div>
  );
}