// src/app/admin/page.js
"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import { Shield, Plus, Trash2, Gavel, Coins, Users, Send, Loader2, AlertTriangle, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false); // 通用加载锁

  // --- 模块1：发布新市场状态 ---
  const [question, setQuestion] = useState('');
  const [desc, setDesc] = useState('');
  const [endTime, setEndTime] = useState('');
  const [options, setOptions] = useState(['选项 A', '选项 B']);

  // --- 模块2：待裁决列表状态 ---
  const [pendingMarkets, setPendingMarkets] = useState([]);

  // --- 模块3：财务中心状态 ---
  const [targetEmail, setTargetEmail] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [airdropAmount, setAirdropAmount] = useState('');

  // --- 模块4：消息广播状态 ---
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [msgTarget, setMsgTarget] = useState('GLOBAL'); // GLOBAL 或 PERSONAL
  const [msgEmail, setMsgEmail] = useState('');

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
  const addOption = () => setOptions([...options, `选项 ${String.fromCharCode(65 + options.length)}`]);
  
  const removeOption = (index) => {
    if (options.length <= 2) return alert("至少保留2个选项");
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
    setIsProcessing(true);

    try {
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

      const optionsToInsert = options.map(name => ({
        market_id: marketData.id,
        name: name,
        pool_amount: 0
      }));

      const { error: optError } = await supabase.from('options').insert(optionsToInsert);
      if (optError) throw optError;

      alert("发布成功！");
      setQuestion(''); setDesc(''); setEndTime(''); setOptions(['选项 A', '选项 B']);
      fetchPendingMarkets();
    } catch (error) {
      alert("发布失败: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 逻辑区：市场管理 ---
  const handleDelete = async (marketId) => {
    if (!confirm("⚠️ 确定删除此市场？操作不可撤销！")) return;
    await supabase.from('markets').delete().eq('id', marketId);
    fetchPendingMarkets();
  };

  const handleResolve = async (marketId, optionId) => {
    if (!confirm("确定裁决此选项获胜？系统将自动分发奖金。")) return;
    
    const { error } = await supabase.rpc('resolve_market_and_payout', {
      p_market_id: marketId,
      p_winner_option_id: optionId,
      p_evidence: "管理员后台直接裁决"
    });

    if (error) alert("裁决失败: " + error.message);
    else {
      alert("裁决成功！");
      fetchPendingMarkets();
    }
  };

  // --- 逻辑区：财务操作 ---
  const handleSendToUser = async () => {
    if (!targetEmail || !sendAmount) return alert("信息不完整");
    setIsProcessing(true);
    const { data, error } = await supabase.rpc('admin_send_money_by_email', {
      p_email: targetEmail, p_amount: sendAmount, p_reason: "管理员转账"
    });
    if (error) alert("失败: " + error.message); else alert(data);
    setIsProcessing(false); setTargetEmail(''); setSendAmount('');
  };

  const handleAirdropAll = async () => {
    if (!airdropAmount) return;
    if (!confirm(`⚠️ 确定给全员发送 ${airdropAmount} 币吗？`)) return;
    setIsProcessing(true);
    const { error } = await supabase.rpc('admin_airdrop_all', {
      p_amount: airdropAmount, p_reason: "全员空投福利"
    });
    if (error) alert("失败: " + error.message); else alert("全员空投完成！");
    setIsProcessing(false); setAirdropAmount('');
  };

  // --- 逻辑区：消息广播 ---
  const handleSendNotification = async () => {
    if (!msgTitle || !msgContent) return alert("标题和内容不能为空");
    if (msgTarget === 'PERSONAL' && !msgEmail) return alert("请填写目标邮箱");
    
    setIsProcessing(true);
    const { error } = await supabase.rpc('admin_send_notification', {
      p_type: msgTarget,
      p_title: msgTitle,
      p_content: msgContent,
      p_target_email: msgTarget === 'PERSONAL' ? msgEmail : null
    });

    if (error) alert("发送失败: " + error.message);
    else {
      alert("通知发送成功！");
      setMsgTitle(''); setMsgContent(''); setMsgEmail('');
    }
    setIsProcessing(false);
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
            <p className="text-slate-400 text-sm">上帝模式：管理预测市场、资金与通知</p>
          </div>
        </div>

        {/* 顶部两列布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* 卡片1：发布新预测 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400">
              <Plus size={20}/> 发布新预测
            </h2>
            <div className="space-y-4">
              <input 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500"
                placeholder="标题" value={question} onChange={e => setQuestion(e.target.value)}
              />
              <textarea 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 h-24"
                placeholder="描述规则..." value={desc} onChange={e => setDesc(e.target.value)}
              />
              <input 
                type="datetime-local"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none text-slate-300"
                onChange={e => setEndTime(e.target.value)}
              />
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input 
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none"
                      value={opt} onChange={e => updateOption(idx, e.target.value)}
                    />
                    {options.length > 2 && (
                      <button onClick={() => removeOption(idx)} className="p-2 text-slate-600 hover:text-red-500"><Trash2 size={16}/></button>
                    )}
                  </div>
                ))}
                <button onClick={addOption} className="text-sm text-blue-400 hover:text-white flex items-center gap-1 mt-2">
                  <Plus size={14}/> 添加选项
                </button>
              </div>
              <button onClick={handleCreateMarket} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold mt-4 flex justify-center items-center">
                {isProcessing ? <Loader2 className="animate-spin"/> : "发布市场"}
              </button>
            </div>
          </div>

          {/* 卡片2：待裁决市场 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col h-[600px]">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-500">
              <Gavel size={20}/> 待裁决 ({pendingMarkets.length})
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {pendingMarkets.length === 0 && <p className="text-slate-500 text-center py-10">暂无市场</p>}
              {pendingMarkets.map(market => (
                <div key={market.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-slate-200">{market.question}</h3>
                    <button onClick={() => handleDelete(market.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {market.options.map(opt => (
                      <button 
                        key={opt.id} onClick={() => handleResolve(market.id, opt.id)}
                        className="text-xs bg-slate-800 hover:bg-green-600/20 hover:text-green-400 border border-slate-700 py-2 rounded transition-all"
                      >
                        判 {opt.name} 赢
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部两列布局：财务与消息 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 卡片3：财务中心 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none"><Coins size={200}/></div>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-400">
              <Coins size={20}/> 财务中心
            </h2>
            
            <div className="space-y-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-sm text-slate-300"><Send size={14}/> 定向转账</h3>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm" placeholder="邮箱" value={targetEmail} onChange={e => setTargetEmail(e.target.value)} />
                  <input className="w-24 bg-slate-900 border border-slate-700 rounded p-2 text-sm" type="number" placeholder="$$" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
                </div>
                <button onClick={handleSendToUser} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-500 py-2 rounded text-sm font-bold">发送资金</button>
              </div>

              <div className="bg-purple-900/10 p-4 rounded-xl border border-purple-500/20">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-sm text-purple-300"><Users size={14}/> 全员空投</h3>
                <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm mb-2" type="number" placeholder="每人多少币" value={airdropAmount} onChange={e => setAirdropAmount(e.target.value)} />
                <button onClick={handleAirdropAll} disabled={isProcessing} className="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded text-sm font-bold">执行空投</button>
              </div>
            </div>
          </div>

          {/* 卡片4：消息广播 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-pink-500">
              <Bell size={20}/> 消息广播
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input className="flex-1 bg-slate-950 border border-slate-700 rounded p-3" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="通知标题" />
                <div className="flex bg-slate-950 rounded border border-slate-700 p-1">
                  <button onClick={() => setMsgTarget('GLOBAL')} className={`px-3 text-xs rounded ${msgTarget === 'GLOBAL' ? 'bg-pink-600' : ''}`}>全员</button>
                  <button onClick={() => setMsgTarget('PERSONAL')} className={`px-3 text-xs rounded ${msgTarget === 'PERSONAL' ? 'bg-pink-600' : ''}`}>个人</button>
                </div>
              </div>
              
              {msgTarget === 'PERSONAL' && (
                <input className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm animate-in fade-in" value={msgEmail} onChange={e => setMsgEmail(e.target.value)} placeholder="目标用户邮箱..." />
              )}
              
              <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-3 h-24" value={msgContent} onChange={e => setMsgContent(e.target.value)} placeholder="通知正文内容..." />
              
              <button onClick={handleSendNotification} disabled={isProcessing} className="w-full bg-pink-600 hover:bg-pink-500 py-3 rounded font-bold transition-all">
                {isProcessing ? "发送中..." : "发送通知"}
              </button>
            </div>
          </div>
           {/* 新增 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl mt-8 lg:col-span-2">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-400">
              <Shield size={20}/> 审核队列 (用户提交)
            </h2>
            <div className="space-y-4">
              {/* 过滤出 PENDING 的市场 */}
              {pendingMarkets.filter(m => m.status === 'PENDING').map(m => (
                <div key={m.id} className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <div className="font-bold">{m.question}</div>
                    <div className="text-xs text-slate-500">{m.description}</div>
                    <div className="text-xs text-slate-500 mt-1">选项: {m.options.map(o=>o.name).join(', ')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async ()=>{
                      await supabase.from('markets').update({status: 'OPEN'}).eq('id', m.id);
                      alert("已批准上线"); fetchPendingMarkets();
                    }} className="bg-green-600 text-xs px-3 py-2 rounded font-bold hover:bg-green-500">批准</button>
                    
                    <button onClick={async ()=>{
                      await supabase.from('markets').delete().eq('id', m.id);
                      alert("已驳回"); fetchPendingMarkets();
                    }} className="bg-red-600 text-xs px-3 py-2 rounded font-bold hover:bg-red-500">驳回</button>
                  </div>
                </div>
              ))}
              {pendingMarkets.filter(m => m.status === 'PENDING').length === 0 && <p className="text-slate-500 text-sm">暂无待审核申请</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}