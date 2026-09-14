import React, { useState } from "react";
import { motion } from "motion/react";

interface AxionLogoProps {
  className?: string;
  variant?: "full" | "mark" | "text-only";
  animate?: boolean;
  pulse?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  isLight?: boolean;
}

export default function AxionLogo({
  className = "",
  variant = "full",
  animate = false,
  pulse = false,
  size = "md",
  isLight = false
}: AxionLogoProps) {
  const [logoSourceState, setLogoSourceState] = useState<"primary" | "secondary" | "fallback">("primary");
  
  // Dimensions based on size
  const sizes = {
    sm: { svg: "w-6 h-6", text: "text-lg tracking-[0.3em] ml-[0.3em]" },
    md: { svg: "w-8 h-8", text: "text-xl tracking-[0.35em] ml-[0.35em]" },
    lg: { svg: "w-14 h-14", text: "text-3xl tracking-[0.4em] ml-[0.4em]" },
    xl: { svg: "w-32 h-32", text: "text-6xl tracking-[0.45em] ml-[0.45em]" }
  };

  const currentSize = sizes[size];

  // Clean pulse
  const pulseProps = pulse ? {
    animate: {
      scale: [1, 1.02, 1],
      opacity: [0.95, 1, 0.95],
      filter: isLight 
        ? [
            "drop-shadow(0 0 10px rgba(0, 0, 0, 0.15))",
            "drop-shadow(0 0 20px rgba(0, 0, 0, 0.25))",
            "drop-shadow(0 0 10px rgba(0, 0, 0, 0.15))"
          ]
        : [
            "drop-shadow(0 0 10px rgba(255, 255, 255, 0.25))",
            "drop-shadow(0 0 20px rgba(255, 255, 255, 0.45))",
            "drop-shadow(0 0 10px rgba(255, 255, 255, 0.25))"
          ]
    },
    transition: {
      duration: 3.2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  } : {};

  // Logo Mark SVG path (Intersecting high-tech precision geometric "A" and "X" prism)
  const LogoMark = () => (
    <motion.div
      className="relative flex items-center justify-center"
      {...pulseProps}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${currentSize.svg} transition-transform duration-300`}
      >
        {/* Left vertical facet */}
        <path
          d="M30 85L50 15L43 15L15 85H30Z"
          fill={isLight ? "url(#leftPrismLight)" : "url(#leftPrism)"}
          className="opacity-90"
        />
        {/* Right vertical facet */}
        <path
          d="M70 85L50 15L57 15L85 85H70Z"
          fill={isLight ? "url(#rightPrismLight)" : "url(#rightPrism)"}
          className="opacity-90"
        />
        {/* Intersecting horizontal cross beam */}
        <path
          d="M23 60H77L80 50H20L23 60Z"
          fill={isLight ? "url(#accentCrossLight)" : "url(#accentCross)"}
          className={isLight ? "mix-blend-multiply opacity-95" : "mix-blend-screen opacity-95"}
        />
        {/* Center light core dot - system active status */}
        <circle cx="50" cy="48" r="4" fill={isLight ? "#0f172a" : "#FFFFFF"} className="animate-pulse" />
        
        {/* Gradients */}
        <defs>
          <linearGradient id="leftPrism" x1="15" y1="85" x2="50" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="rightPrism" x1="85" y1="85" x2="50" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="accentCross" x1="20" y1="55" x2="80" y2="55" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
          </linearGradient>

          {/* Light Mode Gradients */}
          <linearGradient id="leftPrismLight" x1="15" y1="85" x2="50" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="rightPrismLight" x1="85" y1="85" x2="50" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="accentCrossLight" x1="20" y1="55" x2="80" y2="55" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#0f172a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );

  const handlePrimaryError = () => {
    setLogoSourceState("secondary");
  };

  const handleSecondaryError = () => {
    setLogoSourceState("fallback");
  };

  const renderLogo = () => {
    const imgFilter = isLight ? "brightness-0" : "brightness-0 invert";
    if (logoSourceState === "primary") {
      return (
        <motion.img
          src="/logo.png"
          alt="AXION Logo"
          onError={handlePrimaryError}
          className={`${currentSize.svg} object-contain max-w-full max-h-full ${imgFilter} axion-brand-logo`}
          {...pulseProps}
        />
      );
    } else if (logoSourceState === "secondary") {
      return (
        <motion.img
          src="/logo2.png"
          alt="AXION Logo Backup"
          onError={handleSecondaryError}
          className={`${currentSize.svg} object-contain max-w-full max-h-full ${imgFilter} axion-brand-logo`}
          {...pulseProps}
        />
      );
    } else {
      return <LogoMark />;
    }
  };

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${variant === "mark" ? currentSize.svg : "gap-3"} ${className}`}>
      {(variant === "full" || variant === "mark") && renderLogo()}
      
      {(variant === "full" || variant === "text-only") && (
        <div className="flex flex-col items-center justify-center">
          <motion.span
            className={`font-sans font-bold text-center axion-brand-title ${
              isLight ? "text-slate-950 font-extrabold" : "text-white"
            } ${currentSize.text}`}
            style={{ 
              textShadow: isLight ? "none" : "0 0 15px rgba(255, 255, 255, 0.15)",
              letterSpacing: size === "xl" ? "0.45em" : size === "lg" ? "0.35em" : "0.25em"
            }}
          >
            AXION
          </motion.span>
        </div>
      )}
    </div>
  );
}
