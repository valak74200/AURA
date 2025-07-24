import React from "react";
import { motion } from "framer-motion";

/**
 * AnimatedBackground
 * A visually striking, responsive animated background for the app.
 * Uses gradients, blur, and floating shapes for a modern, elegant look.
 */
const AnimatedBackground: React.FC = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    {/* Main gradient background */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-purple-900 to-slate-950 opacity-90" />
    {/* Floating blurred shapes */}
    <motion.div
      className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"
      animate={{
        x: [0, 40, -40, 0],
        y: [0, 30, -30, 0],
        scale: [1, 1.1, 0.95, 1],
        opacity: [0.5, 0.7, 0.5, 0.5],
      }}
      transition={{
        duration: 16,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
    <motion.div
      className="absolute bottom-1/4 right-1/4 w-[36rem] h-[36rem] bg-purple-500/20 rounded-full blur-3xl"
      animate={{
        x: [0, -60, 60, 0],
        y: [0, -40, 40, 0],
        scale: [1.1, 0.9, 1.05, 1.1],
        opacity: [0.4, 0.6, 0.4, 0.4],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
    {/* Subtle grid overlay */}
    <div
      className="absolute inset-0 opacity-10"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0.5' y='0.5' width='39' height='39' rx='7.5' stroke='%23fff' stroke-opacity='0.08'/%3E%3C/svg%3E\")",
      }}
    />
  </div>
);

export default AnimatedBackground;