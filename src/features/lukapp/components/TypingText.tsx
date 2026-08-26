import React, { useState, useEffect } from 'react';

interface TypingTextProps {
  text: string;
  speed?: number;
  className?: string;
}

export const TypingText: React.FC<TypingTextProps> = ({ text, speed = 50, className = '' }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (displayedText.length >= text.length) return;

    const timer = setTimeout(() => {
      setDisplayedText((prev) => prev + text[prev.length]);
    }, speed);

    return () => clearTimeout(timer);
  }, [displayedText, text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {displayedText.length < text.length && (
        <span className="animate-pulse">_</span>
      )}
    </span>
  );
};
