'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TypingAnimationProps {
  text?: string;
  className?: string;
}

export const TypingAnimation = ({
  text = 'Thinking',
  className = '',
}: TypingAnimationProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDots, setShowDots] = useState(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      // Start showing dots after text is complete
      const dotsTimer = setTimeout(() => {
        setShowDots(true);
      }, 500);

      return () => clearTimeout(dotsTimer);
    }
  }, [currentIndex, text]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-muted-foreground">{displayedText}</span>
      <AnimatePresence>
        {showDots && (
          <motion.div
            className="flex gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="text-muted-foreground"
                initial={{ opacity: 0, y: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  y: [0, -2, 0],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: index * 0.2,
                  ease: 'easeInOut',
                }}
              >
                .
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
