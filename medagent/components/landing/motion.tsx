"use client";

import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  useScroll,
  type Variants,
} from "framer-motion";
import {
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";

/* ------------------------------------------------------------------ */
/*  Reduced-motion helper                                              */
/* ------------------------------------------------------------------ */
function usePrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ */
/*  FadeIn — scroll-triggered fade + slide                             */
/* ------------------------------------------------------------------ */
type Direction = "up" | "down" | "left" | "right" | "none";

const offsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 40 },
  down: { x: 0, y: -40 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
  none: { x: 0, y: 0 },
};

export function FadeIn({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  className,
  style,
  once = true,
  amount = 0.3,
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  once?: boolean;
  amount?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const o = offsets[direction];

  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, x: o.x, y: o.y }}
      whileInView={reduced ? undefined : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  StaggerContainer — parent that staggers children via variants      */
/* ------------------------------------------------------------------ */
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export function StaggerContainer({
  children,
  className,
  style,
  stagger = 0.12,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  stagger?: number;
  once?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const variants: Variants = {
    ...containerVariants,
    show: {
      transition: { staggerChildren: stagger, delayChildren: 0.1 },
    },
  };

  if (reduced) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.2 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div variants={itemVariants} className={className} style={style}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  CountUp — animated number counter on viewport enter                */
/* ------------------------------------------------------------------ */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 2,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!isInView) return;
    if (reduced) {
      motionVal.set(to);
      return;
    }
    const controls = animate(motionVal, to, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    return controls.stop;
  }, [isInView, to, duration, motionVal, reduced]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = `${prefix}${v}${suffix}`;
    });
    return unsub;
  }, [rounded, prefix, suffix]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  DrawLine — SVG path that draws itself on scroll                    */
/* ------------------------------------------------------------------ */
export function DrawLine({
  d,
  stroke = "#2563eb",
  strokeWidth = 2,
  className,
}: {
  d: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}) {
  const ref = useRef<SVGPathElement>(null);
  const isInView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.3 });
  const reduced = usePrefersReducedMotion();

  return (
    <motion.path
      ref={ref}
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray="8 6"
      className={className}
      initial={reduced ? undefined : { pathLength: 0, opacity: 0 }}
      animate={
        isInView && !reduced
          ? { pathLength: 1, opacity: 1 }
          : undefined
      }
      transition={{ duration: 1.5, ease: "easeInOut" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  ScaleIn — pop-in with spring physics                               */
/* ------------------------------------------------------------------ */
export function ScaleIn({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, scale: 0.8 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        delay,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  FloatIn — spring-based float for pills/badges                      */
/* ------------------------------------------------------------------ */
export function FloatIn({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 20, scale: 0.9 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        delay,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  ParallaxLayer — scroll-linked vertical offset                      */
/* ------------------------------------------------------------------ */
export function ParallaxLayer({
  children,
  speed = 0.2,
  className,
  style,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 100, -speed * 100]);
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div ref={ref} className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div ref={ref} style={{ y, ...style }} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  GlowPulse — ambient glow behind an element                        */
/* ------------------------------------------------------------------ */
export function GlowPulse({
  children,
  color = "rgba(14, 116, 144, 0.3)",
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <div className={className} style={{ position: "relative" }}>
      <motion.div
        style={{
          position: "absolute",
          inset: "-20%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          filter: "blur(40px)",
          zIndex: 0,
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
