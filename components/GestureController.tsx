import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean, isPinching: boolean, isAiming: boolean) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ onModeChange, currentMode, onHandPosition }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [handPos, setHandPos] = useState<{ x: number; y: number; isPinching: boolean } | null>(null);
  const lastModeRef = useRef<TreeMode>(currentMode);
  
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const pinchFrames = useRef(0); 
  const lastPinchReleaseTime = useRef(0);
  const CONFIDENCE_THRESHOLD = 5;
  
  // ⚡️ 优化：将冷却时间从 1000ms 降低为 300ms，消除延迟感
  const COOLDOWN_MS = 300; 

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setGestureStatus("Camera Error");
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user", frameRate: { ideal: 30, max: 30 } }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
            setGestureStatus("Waiting for hand...");
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
          setGestureStatus("Permission Denied");
        }
      }
    };

    const drawHandSkeleton = (landmarks: any[], isPinching: boolean, isAiming: boolean) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let color = '#D4AF37';
      if (isPinching) color = '#00FF00';
      else if (isAiming) color = '#00FFFF'; 

      const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      connections.forEach(([start, end]) => {
        const s = landmarks[start];
        const e = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(s.x * canvas.width, s.y * canvas.height);
        ctx.lineTo(e.x * canvas.width, e.y * canvas.height);
        ctx.stroke();
      });
      landmarks.forEach((l) => {
        ctx.beginPath();
        ctx.arc(l.x * canvas.width, l.y * canvas.height, 3, 0, 2 * Math.PI);
        ctx.fillStyle = isPinching ? '#FFFFFF' : (isAiming ? '#E0FFFF' : '#228B22');
        ctx.fill();
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;
      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          detectGesture(landmarks);
        } else {
            setGestureStatus("No hand detected");
            setHandPos(null);
            if (onHandPosition) onHandPosition(0.5, 0.5, false, false, false);
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            openFrames.current = 0;
            closedFrames.current = 0;
            pinchFrames.current = 0;
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const detectGesture = (landmarks: any[]) => {
      const wrist = landmarks[0];
      let targetX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      let targetY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;
      
      const isExtended = (tipIdx: number, baseIdx: number, thresholdMultiplier = 1.5) => {
        const tip = landmarks[tipIdx];
        const base = landmarks[baseIdx];
        const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
        return distTip > distBase * thresholdMultiplier;
      };

      const thumbExtended = isExtended(4, 2, 1.2); 
      const indexExtended = isExtended(8, 5);
      const middleExtended = isExtended(12, 9);
      const ringExtended = isExtended(16, 13);
      const pinkyExtended = isExtended(20, 17);

      const otherFingersExtendedCount = [middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
      const totalExtendedCount = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

      const pinchDist = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
      
      const PINCH_THRESHOLD = 0.08;
      const AIMING_THRESHOLD = 0.25; 

      const isThumbIndexClose = pinchDist < PINCH_THRESHOLD; 
      const isThumbIndexAiming = pinchDist < AIMING_THRESHOLD; 

      const isPinchingNow = isThumbIndexClose && otherFingersExtendedCount >= 2;
      const isAimingNow = isThumbIndexAiming && otherFingersExtendedCount >= 2; 

      if (isPinchingNow) {
        pinchFrames.current++;
      } else {
        if (pinchFrames.current > 1) lastPinchReleaseTime.current = Date.now();
        pinchFrames.current = 0;
      }
      
      const isPinchingConfirmed = pinchFrames.current > 1;

      if (isAimingNow || isPinchingConfirmed) {
         targetX = (landmarks[4].x + landmarks[8].x) / 2;
         targetY = (landmarks[4].y + landmarks[8].y) / 2;
      }

      drawHandSkeleton(landmarks, isPinchingConfirmed, isAimingNow);
      setHandPos({ x: targetX, y: targetY, isPinching: isPinchingConfirmed });
      
      if (onHandPosition) {
        onHandPosition(targetX, targetY, true, isPinchingConfirmed, isAimingNow);
      }

      // 优先级 1: 捏合操作 (Select)
      if (isPinchingConfirmed) {
        setGestureStatus("ACTION: CLICK");
        if (lastModeRef.current !== TreeMode.FORMED) {
            lastModeRef.current = TreeMode.FORMED;
            onModeChange(TreeMode.FORMED);
        }
        openFrames.current = 0;
        closedFrames.current = 0;
        return; 
      }

      // 优先级 1.5: 瞄准悬停 (Aiming)
      if (isAimingNow) {
        setGestureStatus("Aiming (Tree Locked)");
        openFrames.current = 0;
        closedFrames.current = 0;
        return; 
      }

      // ⚡️ 优先级 2: 冷却期 (降低到 300ms) ⚡️
      if (Date.now() - lastPinchReleaseTime.current < COOLDOWN_MS) {
        setGestureStatus("..."); 
        return;
      }

      // 优先级 3: 模式切换
      if (totalExtendedCount >= 4 && !isThumbIndexAiming) { 
        openFrames.current++;
        closedFrames.current = 0;
        setGestureStatus("Detected: OPEN (Chaos)");
        if (openFrames.current > CONFIDENCE_THRESHOLD) {
            if (lastModeRef.current !== TreeMode.CHAOS) {
                lastModeRef.current = TreeMode.CHAOS;
                onModeChange(TreeMode.CHAOS);
            }
        }
      } 
      else if (totalExtendedCount <= 1) {
        closedFrames.current++;
        openFrames.current = 0;
        setGestureStatus("Detected: FIST (Formed)");
        if (closedFrames.current > CONFIDENCE_THRESHOLD) {
            if (lastModeRef.current !== TreeMode.FORMED) {
                lastModeRef.current = TreeMode.FORMED;
                onModeChange(TreeMode.FORMED);
            }
        }
      } else {
        setGestureStatus("Tracking...");
        openFrames.current = 0;
        closedFrames.current = 0;
      }
    };

    setupMediaPipe();
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, [onModeChange]);

  useEffect(() => { lastModeRef.current = currentMode; }, [currentMode]);

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-none">
      <div className="relative w-[18.75vw] h-[14.0625vw] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black">
        <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10"></div>
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-20" />
        {handPos && (
          <div 
            className={`absolute w-2 h-2 rounded-full border border-white transition-transform duration-100 ${handPos.isPinching ? 'bg-green-500 scale-125' : 'bg-[#D4AF37]'}`}
            style={{
              left: `${(1 - handPos.x) * 100}%`,
              top: `${handPos.y * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
      </div>
      <div className="mt-2 text-[#D4AF37] font-mono text-xs bg-black/50 px-2 py-1 rounded">
        {gestureStatus}
      </div>
    </div>
  );
};