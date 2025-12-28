// src/app/admin/page.js
"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import { Shield, Plus, Trash2, Gavel, Coins, Users, Send, Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- 模块1：发布新市场状态 ---
  const [question, setQuestion] = useState('');
  const [desc, setDesc] = useState('');
  const [endTime, setEndTime] = useState('');
  const [options, setOptions] = useState(['选项 A', '选项 B']);
  const [isPublishing, setIsPublishing] = useState(false);

  // --- 模块2：待裁决列表状态 ---
  const [pendingMarkets, setPendingMarkets] = useState([]);

  // --- 模块3：财务中心状态 ---
  const [targetEmail, setTargetEmail] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [airdropAmount, setAirdropAmount] = useState('');
  const [isTransacting, setIsTransacting] = useState(false);

  useEffect(() => {
    checkAdmin();
    fetchPendingMarkets();
  }, []);

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    const { data } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
    if (!data?.is_admin) {
      alert("权限不足：你不是管理员");
      router.push('/');
    } else {
      setIsAdmin(true);
      setLoading(false);
    }
  }

  async function fetchPendingMarkets() {
    const { data } = await supabase
      .from('markets')
      .select('*, options(*)')
      .neq('status', 'RESOLVED')
      .order('created_at', { ascending: false });
    setPendingMarkets(data || []);
  }

  // --- 逻辑区：选项操作 ---
  const addOption = () => {
    setOptions([...options, `选项 ${String.fromCharCode(65 + options.length)}`]);
  };

  const removeOption = (index) => {
    if (options.length <= 2) return alert("至少需要保留2个选项");
    const newOpts = [...options];
    newOpts.splice(index, 1);
    setOptions(newOpts);
  };

  const updateOption = (index, val) => {
    const newOpts = [...options];
    newOpts[index] = val;
    setOptions(newOpts);
  };

  // --- 逻辑区：发布市场 ---
  const handleCreateMarket = async () => {
    if (!question || !endTime) return alert("请填写完整标题和截止时间");
    setIsPublishing(true);

    try {
      // 1. 创建市场主体
      const { data: marketData, error: marketError } = await supabase
        .from('markets')
        .insert({
          question,
          description: desc,
          end_time: new Date(endTime).toISOString(),
          status: 'OPEN'
        })
        .select()
        .single();

      if (marketError) throw marketError;

      // 2. 创建选项
      const optionsToInsert = options.map(name => ({
        market_id: marketData.id,
        name: name,
        pool_amount: 0
      }));

      const { error: optError } = await supabase.from('options').insert(optionsToInsert);
      if (optError) throw optError;

      alert("发布成功！");
      setQuestion('');
      setDesc('');
      setEndTime('');
      setOptions(['选项 A', '选项 B']);
      fetchPendingMarkets();
    } catch (error) {
      alert("发布失败: " + error.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // --- 逻辑区：市场管理 ---
  const handleDelete = async (marketId) => {
    if (!confirm("⚠️ 高危操作：确定删除此市场？\n这将删除所有关联的下注记录，且不会退款！仅限测试数据清理使用。")) return;
    await supabase.from('markets').delete().eq('id', marketId);
    fetchPendingMarkets();
  };

  const handleResolve = async (marketId, optionId) => {
    if (!confirm("确定裁决此选项获胜？\n系统将自动计算赔率并分发奖金。")) return;
    
    const { error } = await supabase.rpc('resolve_market_and_payout', {
      p_market_id: marketId,
      p_winner_option_id: optionId,
      p_evidence: "管理员后台直接裁决"
    });

    if (error) alert("裁决失败: " + error.message);
    else {
      alert("裁决成功！资金已分发。");
      fetchPendingMarkets();
    }
  };

  // --- 逻辑区：财务操作 ---
  const handleSendToUser = async () => {
    if (!targetEmail || !sendAmount) return alert("请填写邮箱和金额");
    if (Number(sendAmount) <= 0) return alert("金额必须大于0");
    
    setIsTransacting(true);
    const { data, error } = await supabase.rpc('admin_send_money_by_email', {
      p_email: targetEmail,
      p_amount: sendAmount,
      p_reason: "管理员后台转账"
    });

    if (error) alert("操作失败: " + error.message);
    else alert("系统反馈: " + data);
    
    setIsTransacting(false);
    setTargetEmail('');
    setSendAmount('');
  };

  const handleAirdropAll = async () => {
    if (!airdropAmount || Number(airdropAmount) <= 0) return alert("请输入有效的空投金额");
    if (!confirm(`⚠️ 严重警告 ⚠️\n\n你确定要给数据库里的【每一位用户】都发送 ${airdropAmount} 币吗？\n\n此操作涉及资金巨大，且不可撤销！`)) return;

    setIsTransacting(true);
    const { error } = await supabase.rpc('admin_airdrop_all', {
      p_amount: airdropAmount,
      p_reason: "管理员全员空投福利"
    });

    if (error) alert("空投失败: " + error.message);
    else alert("🎉 全员空投已完成！所有人都收到了钱。");

    setIsTransacting(false);
    setAirdropAmount('');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">验证管理员身份...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-800">
          <div className="p-3 bg-red-600/20 rounded-xl">
            <Shield size={32} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">管理员控制台</h1>
            <p className="text-slate-400 text-sm">上帝模式：管理预测市场与系统资金</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左侧卡片：发布新预测 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400">
              <Plus size={20}/> 发布新预测
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">预测标题</label>
                <input 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 transition-all"
                  placeholder="例如：2025年比特币会突破20万吗？"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">详细描述</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 h-24 transition-all"
                  placeholder="在这里输入详细的裁决规则..."
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">截止时间</label>
                <input 
                  type="datetime-local"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 text-slate-300"
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">选项设置 (动态)</label>
                <div className="space-y-3">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <div className="flex items-center justify-center w-8 bg-slate-800 rounded text-slate-500 text-xs font-mono">
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <input 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none focus:border-blue-500"
                        value={opt}
                        onChange={e => updateOption(idx, e.target.value)}
                      />
                      {options.length > 2 && (
                        <button onClick={() => removeOption(idx)} className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
                          <Trash2 size={16}/>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addOption} className="text-sm text-blue-400 hover:text-white flex items-center gap-1 mt-2 transition-colors">
                    <Plus size={14}/> 添加更多选项
                  </button>
                </div>
              </div>

              <button 
                onClick={handleCreateMarket}
                disabled={isPublishing}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:opacity-50 py-3 rounded-xl font-bold mt-4 transition-all flex justify-center items-center gap-2"
              >
                {isPublishing ? <Loader2 className="animate-spin"/> : "立即发布市场"}
              </button>
            </div>
          </div>

          {/* 右侧卡片：待裁决市场 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col h-[600px]">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-500">
              <Gavel size={20}/> 待裁决市场 ({pendingMarkets.length})
            </h2>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {pendingMarkets.length === 0 && (
                <div className="text-center text-slate-600 py-10 flex flex-col items-center">
                  <Shield size={48} className="mb-4 opacity-20"/>
                  暂无进行中的市场
                </div>
              )}
              
              {pendingMarkets.map(market => (
                <div key={market.id} className="bg-slate-950 border border-slate-800 p-5 rounded-xl group hover:border-slate-600 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-sm text-slate-200 leading-snug">{market.question}</h3>
                    <button 
                      onClick={() => handleDelete(market.id)} 
                      className="text-slate-600 hover:text-red-500 p-1 hover:bg-red-500/10 rounded transition-all"
                      title="强制删除"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono">
                    <span className="bg-slate-900 px-2 py-1 rounded">ID: {market.id}</span>
                    <span>截止: {new Date(market.end_time).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {market.options.map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => handleResolve(market.id, opt.id)}
                        className="text-xs bg-slate-800 hover:bg-green-600/20 hover:text-green-400 hover:border-green-500/50 border border-slate-700 py-2.5 rounded transition-all text-center font-medium"
                      >
                        判 <span className="font-bold">{opt.name}</span> 赢
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部宽卡片：财务中心 */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-2xl relative overflow-hidden shadow-2xl">
            {/* 背景装饰 */}
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
              <Coins size={300}/>
            </div>

            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-green-400">
              <Coins size={28}/> 财务中心
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              
              {/* 功能A: 定向转账 */}
              <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
                  <Send size={18} className="text-blue-400"/> 定向转账
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">目标用户邮箱</label>
                    <input 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500" 
                      placeholder="user@example.com" 
                      value={targetEmail} 
                      onChange={e => setTargetEmail(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">转账金额</label>
                    <input 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 font-mono" 
                      type="number" 
                      placeholder="1000" 
                      value={sendAmount} 
                      onChange={e => setSendAmount(e.target.value)} 
                    />
                  </div>
                  <button 
                    onClick={handleSendToUser} 
                    disabled={isTransacting}
                    className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold transition-all shadow-lg shadow-green-900/20 disabled:opacity-50"
                  >
                    {isTransacting ? "处理中..." : "确认发送"}
                  </button>
                </div>
              </div>

              {/* 功能B: 全员空投 */}
              <div className="bg-purple-900/10 p-6 rounded-xl border border-purple-500/20">
                <h3 className="font-bold mb-2 flex items-center gap-2 text-lg text-purple-400">
                  <Users size={18}/> 全员空投 (Airdrop)
                </h3>
                <div className="flex items-start gap-2 mb-4 bg-purple-900/20 p-3 rounded text-xs text-purple-300">
                  <AlertTriangle size={16} className="shrink-0"/>
                  <p>注意：此操作将给数据库中【所有已注册用户】增加余额。请谨慎操作，避免通货膨胀。</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">每人空投金额</label>
                    <input 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 outline-none focus:border-purple-500 font-mono" 
                      type="number" 
                      placeholder="100" 
                      value={airdropAmount} 
                      onChange={e => setAirdropAmount(e.target.value)} 
                    />
                  </div>
                  <button 
                    onClick={handleAirdropAll} 
                    disabled={isTransacting}
                    className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
                  >
                    {isTransacting ? "正在空投..." : "执行全员空投"}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}