import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode } from '../types';

const PHOTO_COUNT = 22;

interface PolaroidsProps {
  mode: TreeMode;
  handDataRef: React.MutableRefObject<{ x: number; y: number; detected: boolean; isPinching: boolean; isAiming: boolean }>;
  focusedId: number | null;
  setFocusedId: React.Dispatch<React.SetStateAction<number | null>>;
}

interface PhotoData {
  id: number;
  url: string;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
}

const PolaroidItem: React.FC<{ 
  data: PhotoData; 
  mode: TreeMode; 
  isFocused: boolean; 
  isHovered: boolean; 
  index: number 
}> = ({ data, mode, isFocused, isHovered, index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(data.url, (t) => { t.colorSpace = THREE.SRGBColorSpace; setTexture(t); }, undefined, () => setError(true));
  }, [data.url]);
  
  const swayOffset = useMemo(() => Math.random() * 100, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    
    if (isFocused) {
      // 选中：居中放大
      const camera = state.camera;
      const focusTarget = new THREE.Vector3(0, 0, -6);
      focusTarget.applyMatrix4(camera.matrixWorld);
      focusTarget.y += 5;

      groupRef.current.position.lerp(focusTarget, delta * 5);
      groupRef.current.quaternion.slerp(camera.quaternion, delta * 5);
      
      const currentScale = groupRef.current.scale.x;
      const targetScale = 2.5;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, delta * 5);
      groupRef.current.scale.setScalar(newScale);

    } else {
      // 普通状态
      const isFormed = mode === TreeMode.FORMED;
      
      // ⚡️ Hover 预览效果：只要被瞄准，就微微放大
      const targetScale = isHovered ? 1.2 : 1.0;
      if (Math.abs(groupRef.current.scale.x - targetScale) > 0.01) {
        const s = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, delta * 8);
        groupRef.current.scale.setScalar(s);
      }

      const targetPos = isFormed ? data.targetPos : data.chaosPos;
      const step = delta * data.speed;
      groupRef.current.position.lerp(targetPos, step);

      if (isFormed) {
          const dummy = new THREE.Object3D();
          dummy.position.copy(groupRef.current.position);
          dummy.lookAt(0, groupRef.current.position.y, 0); 
          dummy.rotateY(Math.PI);
          groupRef.current.quaternion.slerp(dummy.quaternion, step);
          
          const swayAngle = Math.sin(time * 2.0 + swayOffset) * 0.08;
          const tiltAngle = Math.cos(time * 1.5 + swayOffset) * 0.05;
          const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
          groupRef.current.rotation.z = currentRot.z + swayAngle * 0.05; 
          groupRef.current.rotation.x = currentRot.x + tiltAngle * 0.05;
      } else {
          const cameraPos = new THREE.Vector3(0, 9, 20);
          const dummy = new THREE.Object3D();
          dummy.position.copy(groupRef.current.position);
          dummy.lookAt(cameraPos);
          groupRef.current.quaternion.slerp(dummy.quaternion, delta * 3);
          
          const wobbleX = Math.sin(time * 1.5 + swayOffset) * 0.03;
          const wobbleZ = Math.cos(time * 1.2 + swayOffset) * 0.03;
          const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
          groupRef.current.rotation.x = currentRot.x + wobbleX;
          groupRef.current.rotation.z = currentRot.z + wobbleZ;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group userData={{ isPolaroid: true, id: data.id }}>
        <mesh visible={false}>
            <boxGeometry args={[1.5, 2.0, 0.5]} />
            <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <mesh position={[0, 1.2, -0.1]}>
          <cylinderGeometry args={[0.005, 0.005, 1.5]} />
          <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} transparent opacity={0.6} />
        </mesh>
        
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 1.5, 0.02]} />
            <meshStandardMaterial color="#fdfdfd" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.15, 0.025]}>
            <planeGeometry args={[1.0, 1.0]} />
            {texture && !error ? (
              <meshBasicMaterial map={texture} />
            ) : (
              <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
            )}
          </mesh>
          <mesh position={[0, 0.7, 0.025]} rotation={[0,0,0]}>
             <boxGeometry args={[0.1, 0.05, 0.05]} />
             <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} />
          </mesh>
          <Text position={[0, -0.55, 0.03]} fontSize={0.12} color="#333" anchorX="center" anchorY="middle">
            {error ? "No Img" : `Photo ${data.id + 1}`}
          </Text>
        </group>
      </group>
    </group>
  );
};

export const Polaroids: React.FC<PolaroidsProps> = ({ mode, handDataRef, focusedId, setFocusedId }) => {
  const { camera, raycaster } = useThree();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  
  const wasPinching = useRef(false);
  const itemsRef = useRef<THREE.Group>(null);

  const photoData = useMemo(() => {
    // 数据生成逻辑不变
    const data: PhotoData[] = [];
    const height = 9;
    const maxRadius = 5.0;
    for (let i = 0; i < PHOTO_COUNT; i++) {
      const yNorm = 0.2 + (i / PHOTO_COUNT) * 0.6;
      const y = yNorm * height;
      const r = maxRadius * (1 - yNorm) + 0.8;
      const theta = i * 2.39996;
      const targetPos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
      const relativeY = 5;
      const relativeZ = 20;
      const angle = (i / PHOTO_COUNT) * Math.PI * 2;
      const distance = 3 + Math.random() * 4;
      const chaosPos = new THREE.Vector3(
        distance * Math.cos(angle) * 1.2,
        relativeY + (Math.random() - 0.5) * 8,
        relativeZ - 4 + distance * Math.sin(angle) * 0.5
      );
      data.push({ id: i, url: `/photos/${i + 1}.jpg`, chaosPos, targetPos, speed: 0.8 + Math.random() * 1.5 });
    }
    return data;
  }, []);

  useFrame(() => {
    const hand = handDataRef.current;

    // ⚡️ 只要在 捏合 或 瞄准 状态，都开启 Raycaster (以便松开微调时也能看到高亮)
    if (hand.detected && (hand.isPinching || hand.isAiming)) {
      const ndcX = -((hand.x * 2) - 1);
      const ndcY = -(hand.y * 2) + 1;
      raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

      if (itemsRef.current) {
        const intersects = raycaster.intersectObjects(itemsRef.current.children, true);
        const hit = intersects.find(hit => {
            let obj: THREE.Object3D | null = hit.object;
            while(obj) {
                if (obj.userData && typeof obj.userData.id === 'number') return true;
                obj = obj.parent;
            }
            return false;
        });

        if (hit) {
            let obj: THREE.Object3D | null = hit.object;
            while(obj && !(obj.userData && typeof obj.userData.id === 'number')) obj = obj.parent;
            if (obj) setHoveredId(obj.userData.id);
        } else {
            setHoveredId(null);
        }
      }
    } else {
      setHoveredId(null);
    }

    // 松手确认逻辑
    if (wasPinching.current && !hand.isPinching) {
      if (hoveredId !== null) {
        setFocusedId(prev => prev === hoveredId ? null : hoveredId);
      } else {
        setFocusedId(null);
      }
    }

    wasPinching.current = hand.isPinching;
  });

  return (
    <group ref={itemsRef}>
      {photoData.map((data, i) => (
        <PolaroidItem 
          key={i} 
          index={i} 
          data={data} 
          mode={mode} 
          isFocused={focusedId === data.id}
          isHovered={hoveredId === data.id} 
        />
      ))}
    </group>
  );
};