// src/components/SuccessCheck.js
"use client";
import { motion } from "framer-motion";

export default function SuccessCheck() {
  return (
    <div className="flex justify-center items-center py-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.6)]"
      >
        <motion.svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            d="M20 6L9 17l-5-5"
          />
        </motion.svg>
      </motion.div>
    </div>
  );
}