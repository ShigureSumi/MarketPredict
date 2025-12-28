// src/components/NotificationModal.js
"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function NotificationModal({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (userEmail) {
      fetchNotifications();
    }
  }, [userEmail]);

  async function fetchNotifications() {
    // 调用刚才写的数据库函数
    const { data, error } = await supabase.rpc('get_my_unread_notifications', {
      p_user_email: userEmail
    });
    
    if (data && data.length > 0) {
      setNotifications(data);
      setIsOpen(true); // 有消息就打开弹窗
    }
  }

  async function handleMarkRead() {
    const currentMsg = notifications[currentIndex];
    
    // 1. 数据库标记已读
    await supabase.rpc('mark_notification_read', {
      p_notification_id: currentMsg.id
    });

    // 2. 前端移除这一条
    if (currentIndex < notifications.length - 1) {
      // 如果还有下一条，显示下一条
      setCurrentIndex(currentIndex + 1);
    } else {
      // 如果没有了，关闭弹窗
      setIsOpen(false);
    }
  }

  if (!isOpen || notifications.length === 0) return null;

  const msg = notifications[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-slate-900 border border-blue-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* 顶部装饰条 */}
            <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-full text-blue-400 shrink-0">
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{msg.title}</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(msg.created_at).toLocaleString()} · {msg.type === 'GLOBAL' ? '全员公告' : '个人通知'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 mb-6 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {msg.content}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  消息 {currentIndex + 1} / {notifications.length}
                </span>
                <button 
                  onClick={handleMarkRead}
                  className="bg-white text-black hover:bg-slate-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                  <Check size={16} /> 我已收到
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}