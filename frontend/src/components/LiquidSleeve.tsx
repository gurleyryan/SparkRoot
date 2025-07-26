
import React, { useRef, useState, useCallback, Suspense } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import clsx from "clsx";

const manaThemes = {
  white: {
    border: "border-mtg-white",
    glow: "shadow-[0_0_32px_4px_rgba(249,250,244,0.25)]",
    gradient: "from-mtg-white/60 via-white/20 to-mtg-white/10",
  },
  blue: {
    border: "border-mtg-blue",
    glow: "shadow-[0_0_32px_4px_rgba(14,104,171,0.18)]",
    gradient: "from-mtg-blue/60 via-blue-200/20 to-mtg-blue/10",
  },
  black: {
    border: "border-mtg-black",
    glow: "shadow-[0_0_32px_4px_rgba(21,11,0,0.18)]",
    gradient: "from-mtg-black/60 via-black/20 to-mtg-black/10",
  },
  red: {
    border: "border-mtg-red",
    glow: "shadow-[0_0_32px_4px_rgba(211,32,42,0.18)]",
    gradient: "from-mtg-red/60 via-red-200/20 to-mtg-red/10",
  },
  green: {
    border: "border-mtg-green",
    glow: "shadow-[0_0_32px_4px_rgba(0,115,62,0.18)]",
    gradient: "from-mtg-green/60 via-green-200/20 to-mtg-green/10",
  },
  multicolor: {
    border: "border-mtg-blue border-2 border-dashed",
    glow: "shadow-[0_0_32px_4px_rgba(179,206,234,0.12)]",
    gradient: "from-mtg-blue/60 via-mtg-green/40 to-mtg-red/30",
  },
  colorless: {
    border: "border-gray-300",
    glow: "shadow-[0_0_32px_4px_rgba(200,200,200,0.10)]",
    gradient: "from-gray-200/60 via-gray-100/20 to-gray-300/10",
  },
};
type ManaTheme = keyof typeof manaThemes;

export interface LiquidSleeveProps {
  children: React.ReactNode;
  manaTheme?: ManaTheme;
  className?: string;
  style?: React.CSSProperties;
  animated?: boolean;
  plasticIntensity?: number; // 0-1, controls blur/opacity
  border?: boolean;
  showShader?: boolean;
}

// Lazy load the shader background (standard default export)
const LiquidSleeveShader = React.lazy(() => import("./LiquidSleeveShader"));

/**
 * LiquidSleeve: A magical, plasticy, animated sleeve-morphism container for MTG cards and panels.
 * A "window into the multiverse" effect.
 * Includes: animated shimmer, parallax, glint, and optional WebGL shader background.
 */
const LiquidSleeve: React.FC<LiquidSleeveProps> = ({
  children,
  manaTheme = "blue",
  className = "",
  style = {},
  animated = true,
  plasticIntensity = 0.7,
  border = true,
  showShader = true,
}) => {
  const theme = manaThemes[manaTheme] || manaThemes.blue;
  const ref = useRef<HTMLDivElement>(null);

  // Parallax effect (pointer-based)
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 60, damping: 12 });
  const springY = useSpring(y, { stiffness: 60, damping: 12 });
  const rotateX = useTransform(springY, [ -40, 40 ], [ 10, -10 ]);
  const rotateY = useTransform(springX, [ -40, 40 ], [ -10, 10 ]);

  // Glint animation
  const [glint, setGlint] = useState(false);
  const triggerGlint = useCallback(() => {
    setGlint(true);
    setTimeout(() => setGlint(false), 700);
  }, []);

  // Pointer move for parallax
  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    x.set(px - rect.width / 2);
    y.set(py - rect.height / 2);
  };
  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Shimmer animation
  const shimmerVariants = {
    initial: { opacity: 0.9, x: 0 },
    animate: {
      opacity: [0.9, 1, 0.9],
      x: [0, 0, 0],
      transition: {
        duration: 3.5,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={clsx(
        "relative overflow-hidden sleeve-morphism",
        border && theme.border,
        theme.glow,
        className
      )}
      style={{
        ...style,
        background:
          `linear-gradient(120deg, rgba(255,255,255,${0.08 * plasticIntensity}) 0%, rgba(255,255,255,${0.01 * plasticIntensity}) 100%),` +
          `radial-gradient(circle at 60% 20%, rgba(255,255,255,${0.10 * plasticIntensity}) 0%, transparent 60%)`,
        backdropFilter: `blur(${2 + 6 * plasticIntensity}px) saturate(${1 + plasticIntensity})`,
        WebkitBackdropFilter: `blur(${2 + 6 * plasticIntensity}px) saturate(${1 + plasticIntensity})`,
        perspective: 800,
      }}
      initial="initial"
      animate={animated ? "animate" : "initial"}
      variants={animated ? shimmerVariants : undefined}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={triggerGlint}
    >
      {/* WebGL shader background (optional, lazy loaded) */}
      {showShader && (
        <Suspense fallback={null}>
          <LiquidSleeveShader
            intensity={plasticIntensity}
            manaTheme={manaTheme}
            width={ref.current?.offsetWidth || 300}
            height={ref.current?.offsetHeight || 300}
          />
        </Suspense>
      )}
      {/* Animated shimmer overlay */}
      {animated && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              `linear-gradient(120deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 100%)`,
            mixBlendMode: "screen",
            opacity: 0.18 * plasticIntensity,
          }}
          variants={shimmerVariants}
        />
      )}
      {/* Glint effect (animated white sweep) */}
      {glint && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0, x: -120 }}
          animate={{ opacity: [0.2, 0.5, 0], x: [ -120, 120 ] }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          style={{
            background:
              "linear-gradient(100deg, rgba(255,255,255,0.0) 60%, rgba(255,255,255,0.25) 80%, rgba(255,255,255,0.0) 100%)",
            mixBlendMode: "screen",
          }}
        />
      )}
      {/* Optional mana color border glow */}
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 z-0",
          border && theme.glow
        )}
        aria-hidden="true"
      />
      {/* Content (no parallax/rotation applied) */}
      <div className="relative z-30">
        {children}
      </div>
    </motion.div>
  );
};

export default LiquidSleeve;
