import * as React from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Small helper — detects touch-only devices so we can skip hover
 * effects (tilt, magnetic, spotlight) that only make sense on
 * real pointers. Evaluated once on mount; fine for this use case.
 */
function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(true);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(pointer: fine)');
    setFine(mql.matches);
    const update = (): void => setFine(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return fine;
}

/* ─────────────────────────────────────────────────────────
 * ScrollProgress — a thin brand-gradient bar that fills at
 * the top of the viewport as the user scrolls.
 * ──────────────────────────────────────────────────────── */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 30,
    restDelta: 0.001,
  });
  return (
    <motion.div
      style={{ scaleX }}
      aria-hidden
      className="fixed left-0 top-0 z-[60] h-[2px] w-full origin-left bg-gradient-to-r from-[var(--color-brand-400)] via-[var(--color-brand-500)] to-[var(--color-accent-500)]"
    />
  );
}

/* ─────────────────────────────────────────────────────────
 * MouseSpotlight — a soft radial glow that follows the cursor
 * inside a bounded container. Disabled on touch devices and
 * when the user prefers reduced motion. Sized modestly (420px)
 * so the GPU blur cost stays reasonable.
 * ──────────────────────────────────────────────────────── */
export function MouseSpotlight({
  children,
  className,
  color = 'rgba(16, 185, 129, 0.14)',
  size = 420,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  size?: number;
}) {
  const finePointer = useFinePointer();
  const reduced = useReducedMotion();
  const enabled = finePointer && !reduced;
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  // Tighter spring (higher damping) = fewer compositor updates per frame.
  const xs = useSpring(x, { stiffness: 160, damping: 30, mass: 0.5 });
  const ys = useSpring(y, { stiffness: 160, damping: 30, mass: 0.5 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!ref.current || !enabled) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }
  function handleLeave(): void {
    x.set(-1000);
    y.set(-1000);
  }

  return (
    <div
      ref={ref}
      onMouseMove={enabled ? handleMove : undefined}
      onMouseLeave={enabled ? handleLeave : undefined}
      className={cn('relative overflow-hidden', className)}
    >
      {enabled ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full [filter:blur(48px)]"
          style={{
            left: xs,
            top: ys,
            width: size,
            height: size,
            background: `radial-gradient(circle at center, ${color}, transparent 65%)`,
            willChange: 'transform',
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * GradientOrbs — two slowly floating color discs behind the
 * hero. Uses pure CSS keyframes (cheaper than JS animation)
 * and slimmer blur radius (56px instead of 96px) so the
 * compositor can keep up.
 * ──────────────────────────────────────────────────────── */
export function GradientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="landing-orb absolute size-[380px] rounded-full bg-[var(--color-brand-500)] opacity-[0.18]"
        style={{ top: '8%', left: '6%', animationDelay: '0s' }}
      />
      <div
        className="landing-orb-alt absolute size-[460px] rounded-full bg-[var(--color-accent-500)] opacity-[0.12]"
        style={{ top: '18%', right: '4%', animationDelay: '-8s' }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * AnimatedCounter — counts from 0 to `value` once in view.
 * Locale-aware formatting, supports prefix/suffix.
 * ──────────────────────────────────────────────────────── */
interface CounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}
export function AnimatedCounter({
  value,
  duration = 1.6,
  prefix = '',
  suffix = '',
  className,
}: CounterProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = React.useState(reduced ? String(value) : '0');

  React.useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [inView, value, duration, mv, reduced]);

  React.useEffect(
    () =>
      mv.on('change', (latest) => {
        setDisplay(Math.round(latest).toLocaleString('en-US'));
      }),
    [mv],
  );

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
 * TiltCard — 3D perspective tilt on pointer devices only.
 * Intentionally used sparingly on the landing page because
 * tracking cursor position across many instances at once
 * stresses the compositor. Disabled on touch and reduced
 * motion.
 * ──────────────────────────────────────────────────────── */
export function TiltCard({
  children,
  className,
  intensity = 6,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const finePointer = useFinePointer();
  const reduced = useReducedMotion();
  const enabled = finePointer && !reduced;
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const xs = useSpring(mx, { stiffness: 200, damping: 25 });
  const ys = useSpring(my, { stiffness: 200, damping: 25 });
  const rotateX = useTransform(ys, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(xs, [-0.5, 0.5], [-intensity, intensity]);

  function handleMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!ref.current || !enabled) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave(): void {
    mx.set(0);
    my.set(0);
  }

  if (!enabled) {
    // Plain wrapper on touch/reduced — no animation overhead at all.
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Magnetic — gently pulls its child toward the cursor. Skips
 * on touch devices / reduced motion.
 * ──────────────────────────────────────────────────────── */
export function Magnetic({
  children,
  className,
  strength = 3,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const finePointer = useFinePointer();
  const reduced = useReducedMotion();
  const enabled = finePointer && !reduced;
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xs = useSpring(x, { stiffness: 260, damping: 20 });
  const ys = useSpring(y, { stiffness: 260, damping: 20 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!ref.current || !enabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) / strength);
    y.set((e.clientY - cy) / strength);
  }
  function handleLeave(): void {
    x.set(0);
    y.set(0);
  }

  if (!enabled) return <span className={cn('inline-block', className)}>{children}</span>;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: xs, y: ys }}
      className={cn('inline-block', className)}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Reveal — whileInView fade+slide-up wrapper.
 * ──────────────────────────────────────────────────────── */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
 * AnimatedHeadline — word stagger on entry.
 * ──────────────────────────────────────────────────────── */
const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};
const word: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export function AnimatedHeadline({
  lines,
  className,
}: {
  lines: Array<Array<string | { text: string; gradient?: boolean }>>;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <h1 className={className}>
        {lines.map((ln, i) => (
          <span key={i} className="block">
            {ln.map((tok, j) => {
              const text = typeof tok === 'string' ? tok : tok.text;
              const grad = typeof tok === 'object' && tok.gradient;
              return (
                <span key={`${i}-${j}`} className={cn(grad && 'text-gradient', j < ln.length - 1 ? 'mr-[0.28em]' : '')}>
                  {text}
                </span>
              );
            })}
          </span>
        ))}
      </h1>
    );
  }
  return (
    <motion.h1 variants={container} initial="hidden" animate="visible" className={className}>
      {lines.map((ln, i) => (
        <span key={i} className="block">
          {ln.map((tok, j) => {
            const text = typeof tok === 'string' ? tok : tok.text;
            const grad = typeof tok === 'object' && tok.gradient;
            return (
              <motion.span
                key={`${i}-${j}`}
                variants={word}
                className={cn(
                  'inline-block',
                  grad && 'text-gradient',
                  j < ln.length - 1 ? 'mr-[0.28em]' : '',
                )}
              >
                {text}
              </motion.span>
            );
          })}
        </span>
      ))}
    </motion.h1>
  );
}

/* ─────────────────────────────────────────────────────────
 * AnimatedSparkline — self-drawing SVG chart.
 * ──────────────────────────────────────────────────────── */
export function AnimatedSparkline() {
  return (
    <div className="relative h-36 w-full">
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="hero-sparkline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>

        <motion.path
          d="M0,80 C40,70 70,55 110,50 C150,45 180,60 220,40 C260,20 290,30 330,18 C360,10 390,14 400,6 L400,100 L0,100 Z"
          fill="url(#hero-sparkline)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        />

        <motion.path
          d="M0,80 C40,70 70,55 110,50 C150,45 180,60 220,40 C260,20 290,30 330,18 C360,10 390,14 400,6"
          fill="none"
          stroke="url(#hero-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.3 },
          }}
        />

        <motion.circle
          cx="400"
          cy="6"
          r="4"
          fill="#fbbf24"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.4, 1] }}
          transition={{ delay: 1.6, duration: 1.4, repeat: Infinity, repeatType: 'reverse' }}
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * LivePulse — small "live" indicator dot with a pulsing halo.
 * Pure CSS animation, costs basically nothing.
 * ──────────────────────────────────────────────────────── */
export function LivePulse({ label = 'Live' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)] backdrop-blur">
      <span className="relative flex size-2 items-center justify-center">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-brand-500)] opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-[var(--color-brand-500)]" />
      </span>
      {label}
    </span>
  );
}
