import React, { useEffect, useRef } from 'react';
import { TreeMode } from '../types';

interface HandData {
  x: number;
  y: number;
  detected: boolean;
  isPinching: boolean;
  isAiming: boolean;
}

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  handDataRef: React.MutableRefObject<HandData>;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onToggle, handDataRef }) => {
  const isFormed = mode === TreeMode.FORMED;
  const cursorRef = useRef<HTMLDivElement>(null);
  const currentPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let animationFrameId: number;

    const updateCursor = () => {
      const hand = handDataRef.current;
      const cursor = cursorRef.current;

      if (cursor) {
        if (hand.detected) {
          const screenX = (1 - hand.x) * window.innerWidth;
          const screenY = hand.y * window.innerHeight;

          currentPos.current.x += (screenX - currentPos.current.x) * 0.2;
          currentPos.current.y += (screenY - currentPos.current.y) * 0.2;

          cursor.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`;
          cursor.style.opacity = '1';

          if (hand.isPinching) {
            cursor.classList.add('pinching');
          } else {
            cursor.classList.remove('pinching');
          }
        } else {
          cursor.style.opacity = '0';
        }
      }
      animationFrameId = requestAnimationFrame(updateCursor);
    };

    updateCursor();
    return () => cancelAnimationFrame(animationFrameId);
  }, [handDataRef]);

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-8 z-10">
      <div 
        ref={cursorRef}
        className="fixed top-0 left-0 z-50 pointer-events-none transition-opacity duration-300 ease-out will-change-transform"
        style={{ marginTop: '-12px', marginLeft: '-12px' }}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute inset-0 border border-[#D4AF37] rounded-full opacity-60 animate-[spin_4s_linear_infinite] shadow-[0_0_8px_#D4AF37]"></div>
          <div className="relative transition-all duration-200 ease-in-out group-pinching:scale-75">
            <svg viewBox="0 0 24 24" className={`w-4 h-4 drop-shadow-sm transition-colors duration-200 text-[#F5E6BF]`}>
              <style>{`.pinching svg { color: #FF4444 !important; filter: drop-shadow(0 0 4px #FF0000); transform: scale(0.9); } .pinching .border { border-color: #FF4444 !important; }`}</style>
              <path fill="currentColor" d="M11 2v9H2v2h9v9h2v-9h9v-2h-9V2h-2z" />
            </svg>
          </div>
          <div className="absolute -bottom-3 text-[6px] font-serif tracking-widest text-[#D4AF37] opacity-0 transition-opacity duration-200 pinching-text whitespace-nowrap">OK</div>
          <style>{`.pinching .pinching-text { opacity: 1; color: #FF4444; }`}</style>
        </div>
      </div>
      
      <header className="flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-lg tracking-wider text-center">Merry Christmas</h1>
      </header>
      
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#D4AF37] opacity-50"></div>
    </div>
  );
};