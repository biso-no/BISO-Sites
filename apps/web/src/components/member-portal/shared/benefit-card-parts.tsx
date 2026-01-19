"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Check, Copy, ExternalLink, QrCode, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const CONFETTI_COUNT = 12;

/**
 * Animated confetti effect for copy actions
 */
export function ConfettiAnimation() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      exit={{ opacity: 0 }}
      initial={{ opacity: 1 }}
    >
      {[...new Array(CONFETTI_COUNT)].map((_, i) => (
        <motion.div
          animate={{
            x: `${50 + (Math.random() - 0.5) * 100}%`,
            y: `${50 + (Math.random() - 0.5) * 100}%`,
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          className="absolute h-2 w-2 rounded-full bg-brand"
          initial={{ x: "50%", y: "50%", scale: 0 }}
          key={i}
          transition={{ duration: 0.6, delay: i * 0.03 }}
        />
      ))}
    </motion.div>
  );
}

type CodeRevealProps = {
  value: string;
  showConfetti: boolean;
  copiedCode: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
};

/**
 * Revealed code display with copy functionality
 */
export function CodeReveal({
  value,
  showConfetti,
  copiedCode,
  onCopy,
  copyLabel,
  copiedLabel,
}: CodeRevealProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-brand-border border-dashed bg-brand-muted p-4 dark:border-brand-border-strong dark:bg-brand-muted-strong">
      <AnimatePresence>{showConfetti && <ConfettiAnimation />}</AnimatePresence>

      <div className="flex items-center justify-between gap-4">
        <code className="font-mono text-foreground text-lg dark:text-foreground">
          {value}
        </code>
        <Button
          className="shrink-0"
          onClick={onCopy}
          size="sm"
          variant="outline"
        >
          {copiedCode ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-500" />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

type QrRevealProps = {
  value: string;
};

/**
 * QR code display
 */
export function QrReveal({ value: _value }: QrRevealProps) {
  return (
    <div className="flex justify-center rounded-xl bg-section p-6 dark:bg-inverted">
      <div className="flex h-36 w-36 items-center justify-center rounded-xl border-2 border-border bg-background dark:border-border dark:bg-inverted">
        <QrCode className="h-24 w-24 text-muted-foreground dark:text-muted-foreground" />
      </div>
    </div>
  );
}

type LinkRevealProps = {
  value: string;
  gradient: string;
  label: string;
};

/**
 * Link activation button
 */
export function LinkReveal({ value, gradient, label }: LinkRevealProps) {
  return (
    <Button
      className={`w-full bg-gradient-to-r ${gradient} text-white hover:opacity-90`}
      onClick={() => window.open(value, "_blank")}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

type RevealButtonProps = {
  isRevealing: boolean;
  gradient: string;
  onReveal: () => void;
  revealLabel: string;
  revealingLabel: string;
};

/**
 * Button to reveal a benefit
 */
export function RevealButton({
  isRevealing,
  gradient,
  onReveal,
  revealLabel,
  revealingLabel,
}: RevealButtonProps) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      initial={{ opacity: 0 }}
      key="reveal-button"
    >
      <Button
        className={`w-full bg-gradient-to-r ${gradient} text-white hover:opacity-90`}
        disabled={isRevealing}
        onClick={onReveal}
      >
        {isRevealing ? (
          <motion.div
            animate={{ rotate: 360 }}
            className="mr-2 h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {isRevealing ? revealingLabel : revealLabel}
      </Button>
    </motion.div>
  );
}
