import React, { useState, Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import { TreeMode } from './types';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("Error loading 3D scene:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-[#D4AF37] font-serif p-8 text-center">
          <div>
            <h2 className="text-2xl mb-2">Resource Error</h2>
            <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 border border-[#D4AF37]">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  
  // ⚡️ 增加 isAiming 字段
  const handDataRef = useRef({ x: 0.5, y: 0.5, detected: false, isPinching: false, isAiming: false });

  const toggleMode = () => {
    setMode((prev) => (prev === TreeMode.FORMED ? TreeMode.CHAOS : TreeMode.FORMED));
  };

  const handleHandPosition = useCallback((x: number, y: number, detected: boolean, isPinching: boolean, isAiming: boolean) => {
    handDataRef.current = { x, y, detected, isPinching, isAiming };
  }, []);

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-black via-[#001a0d] to-[#0a2f1e]">
      <ErrorBoundary>
        <Canvas
          dpr={[1, 2]} 
          camera={{ position: [0, 4, 20], fov: 45 }}
          gl={{ antialias: false, stencil: false, alpha: false }}
          shadows={false} 
        >
          <Suspense fallback={null}>
            <Experience mode={mode} onModeChange={setMode} handDataRef={handDataRef} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      
      <Loader 
        containerStyles={{ background: '#000' }} 
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ background: '#D4AF37', height: '10px' }}
        dataStyles={{ color: '#D4AF37', fontFamily: 'Cinzel' }}
      />
      
      <UIOverlay mode={mode} onToggle={toggleMode} handDataRef={handDataRef} />
      <GestureController currentMode={mode} onModeChange={setMode} onHandPosition={handleHandPosition} />
    </div>
  );
}