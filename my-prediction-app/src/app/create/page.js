"use client";
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import { Plus, Trash2, Loader2, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function CreateMarket() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [desc, setDesc] = useState('');
  const [endTime, setEndTime] = useState('');
  const [options, setOptions] = useState(['Yes', 'No']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if(!confirm("发布将扣除 100 币，且需等待管理员审核。确定吗？")) return;
    setIsSubmitting(true);
    
    // 调用数据库函数
    const { error } = await supabase.rpc('create_user_market', {
      p_question: question,
      p_desc: desc,
      p_end_time: new Date(endTime).toISOString(),
      p_options: options
    });

    if (error) {
      alert("发布失败: " + error.message);
    } else {
      alert("提交成功！扣除100币。请等待管理员审核。");
      router.push('/');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Plus className="text-blue-500"/> 发起预测
        </h1>
        
        <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-8 flex gap-3 text-sm text-blue-200">
          <Info className="shrink-0"/>
          <div>
            <p className="font-bold mb-1">规则说明：</p>
            <ul className="list-disc pl-4 space-y-1 opacity-80">
              <li>创建需支付 <strong>100 币</strong> 服务费。</li>
              <li>提交后需管理员审核才能上线。</li>
              <li>作为发起人，你<strong>不能参与投注</strong>。</li>
              <li>你需要负责最终裁决，且需<strong>质押所有余额</strong>作为担保。</li>
              <li>如果裁决无异议，你将获得总奖池 <strong>5%</strong> 的分红！</li>
            </ul>
          </div>
        </div>

        <div className="space-y-6 bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div>
            <label className="block text-sm font-bold mb-2">预测标题</label>
            <input className="w-full bg-slate-950 border border-slate-700 rounded p-3" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="例如：明天会下雨吗？"/>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">详细规则</label>
            <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-3 h-24" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="裁决标准..."/>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">截止时间</label>
            <input type="datetime-local" className="w-full bg-slate-950 border border-slate-700 rounded p-3" onChange={e=>setEndTime(e.target.value)}/>
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-2">选项</label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input className="flex-1 bg-slate-950 border border-slate-700 rounded p-2" value={opt} onChange={e=>{
                  const n = [...options]; n[i]=e.target.value; setOptions(n);
                }}/>
                {options.length>2 && <button onClick={()=>{const n=[...options];n.splice(i,1);setOptions(n)}}><Trash2 className="text-red-500"/></button>}
              </div>
            ))}
            <button onClick={()=>setOptions([...options, 'New'])} className="text-sm text-blue-400">+ 添加选项</button>
          </div>

          <button onClick={handleCreate} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold flex justify-center">
            {isSubmitting ? <Loader2 className="animate-spin"/> : "支付 100 币并提交"}
          </button>
        </div>
      </div>
    </div>
  );
}