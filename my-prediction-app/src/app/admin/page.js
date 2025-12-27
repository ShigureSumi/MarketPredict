// src/app/admin/page.js
"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import { Shield, Plus, Trash2, Gavel, AlertCircle, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- 发布市场状态 ---
  const [question, setQuestion] = useState('');
  const [desc, setDesc] = useState('');
  const [endTime, setEndTime] = useState('');
  const [options, setOptions] = useState(['选项 A', '选项 B']); // 默认两个选项

  // --- 待裁决列表状态 ---
  const [pendingMarkets, setPendingMarkets] = useState([]);

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
      alert("你不是管理员，禁止入内！");
      router.push('/');
    } else {
      setIsAdmin(true);
      setLoading(false);
    }
  }

  async function fetchPendingMarkets() {
    // 获取未裁决的市场
    const { data } = await supabase
      .from('markets')
      .select('*, options(*)')
      .neq('status', 'RESOLVED') // 只看没结束的
      .order('created_at', { ascending: false });
    setPendingMarkets(data || []);
  }

  // --- 功能1: 动态添加/删除选项 ---
  const addOption = () => setOptions([...options, `选项 ${String.fromCharCode(65 + options.length)}`]);
  const removeOption = (index) => {
    if (options.length <= 2) return alert("至少需要2个选项");
    const newOpts = [...options];
    newOpts.splice(index, 1);
    setOptions(newOpts);
  };
  const updateOption = (index, val) => {
    const newOpts = [...options];
    newOpts[index] = val;
    setOptions(newOpts);
  };

  // --- 功能2: 发布新市场 ---
  const handleCreateMarket = async () => {
    if (!question || !endTime) return alert("请填写完整信息");

    // 1. 插入 Market
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

    if (marketError) return alert("创建失败: " + marketError.message);

    // 2. 插入 Options
    const optionsToInsert = options.map(name => ({
      market_id: marketData.id,
      name: name,
      pool_amount: 0
    }));

    const { error: optError } = await supabase.from('options').insert(optionsToInsert);

    if (optError) {
      alert("选项插入失败");
    } else {
      alert("发布成功！");
      // 重置表单
      setQuestion('');
      setDesc('');
      setOptions(['选项 A', '选项 B']);
      fetchPendingMarkets(); // 刷新列表
    }
  };

  // --- 功能3: 裁决 (上帝之手) ---
  const handleResolve = async (marketId, optionId) => {
    if (!confirm("确定要判定这个选项获胜吗？此操作不可撤销，并将自动分钱！")) return;

    // 调用我们在数据库里写的那个 RPC 函数 (resolve_market_and_payout)
    const { error } = await supabase.rpc('resolve_market_and_payout', {
      p_market_id: marketId,
      p_winner_option_id: optionId,
      p_evidence: "管理员手动裁决"
    });

    if (error) {
      alert("裁决失败: " + error.message);
    } else {
      alert("裁决成功！奖金已派发。");
      fetchPendingMarkets();
    }
  };

  // --- 功能4: 删除市场 ---
  const handleDelete = async (marketId) => {
    if (!confirm("确定删除？所有下注记录将失效（注意：这不会退款，仅用于测试数据清理）")) return;
    await supabase.from('markets').delete().eq('id', marketId);
    fetchPendingMarkets();
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-10">验证身份中...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black mb-8 flex items-center gap-3 text-red-500">
          <Shield size={32} /> 管理员控制台
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左侧：发布新预测 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Plus className="text-blue-500"/> 发布新预测
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">问题标题</label>
                <input 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500"
                  placeholder="例如：2025年春节是几号？"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">详细描述</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 h-24"
                  placeholder="规则说明..."
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">截止时间</label>
                <input 
                  type="datetime-local"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-blue-500 text-slate-400"
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">选项设置 (支持多选)</label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none"
                        value={opt}
                        onChange={e => updateOption(idx, e.target.value)}
                      />
                      {options.length > 2 && (
                        <button onClick={() => removeOption(idx)} className="p-2 text-red-500 hover:bg-slate-800 rounded">
                          <Trash2 size={16}/>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addOption} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2">
                    <Plus size={14}/> 添加选项
                  </button>
                </div>
              </div>

              <button 
                onClick={handleCreateMarket}
                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold mt-4 transition-all"
              >
                立即发布
              </button>
            </div>
          </div>

          {/* 右侧：裁决市场 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Gavel className="text-yellow-500"/> 待裁决市场
            </h2>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {pendingMarkets.length === 0 && <p className="text-slate-500">暂无进行中的市场</p>}
              
              {pendingMarkets.map(market => (
                <div key={market.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-slate-200">{market.question}</h3>
                    <button onClick={() => handleDelete(market.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    ID: {market.id} | 截止: {new Date(market.end_time).toLocaleDateString()}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {market.options.map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => handleResolve(market.id, opt.id)}
                        className="text-xs bg-slate-800 hover:bg-green-600/20 hover:text-green-400 hover:border-green-500/50 border border-slate-700 py-2 rounded transition-all text-left px-3"
                      >
                        判 <span className="font-bold">{opt.name}</span> 赢
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}