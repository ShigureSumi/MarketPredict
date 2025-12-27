// src/app/profile/page.js
"use client";
// ... (引入部分与上面类似，重点是获取 Transactions 和 Bets)
// 由于篇幅限制，这里提供核心逻辑：

// 修改用户名
async function updateUsername(newName) {
  const { error } = await supabase.from('profiles').update({ username: newName }).eq('id', user.id);
  if (!error) alert("修改成功");
}

// 渲染列表
// transactions.map(t => (
//   <div className="flex justify-between p-3 border-b border-slate-800">
//      <span>{t.description}</span>
//      <span className={t.amount > 0 ? "text-green-400" : "text-red-400"}>
//        {t.amount > 0 ? "+" : ""}{t.amount}
//      </span>
//   </div>
// ))