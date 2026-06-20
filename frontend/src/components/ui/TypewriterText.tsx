import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ 
  text, 
  speed = 30, 
  className = "",
  onComplete 
}) => {
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    setDisplayedText("");
    let i = 0;
    const intervalId = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(intervalId);
        if (onComplete) onComplete();
      }
    }, speed);
    
    return () => clearInterval(intervalId);
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      <span className="animate-pulse opacity-75">|</span>
    </span>
  );
};

export default TypewriterText;
