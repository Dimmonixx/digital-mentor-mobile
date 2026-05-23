import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

export interface Zone {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  containerWidth: number;
  containerHeight: number;
  zones: Zone[];
  onZonesChange: (zones: Zone[]) => void;
  mode?: 'free' | 'linked';
}

const MIN_SIZE = 0.06;

const DraggableZone = ({
  zone,
  containerWidth,
  containerHeight,
  onUpdate,
  onActivate,
  isActive,
}: {
  zone: Zone;
  containerWidth: number;
  containerHeight: number;
  onUpdate: (updated: Zone) => void;
  onActivate: (id: string | null) => void;
  isActive: boolean;
}) => {
  // Храним ТЕКУЩУЮ позицию в ref — не зависит от ре-рендеров
  const posRef = useRef({ x: zone.x, y: zone.y, width: zone.width, height: zone.height });
  
  // Синхронизируем ref с пропсами ТОЛЬКО если зона не активна
  const isActiveRef = useRef(false);
  isActiveRef.current = isActive;
  
  if (!isActiveRef.current) {
    posRef.current = { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
  }

  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0 });

  // Локальное состояние для рендера
  const [localPos, setLocalPos] = useState({
    x: zone.x, y: zone.y, width: zone.width, height: zone.height
  });

  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isActiveRef.current = true;
        onActivate(zone.id);
        dragStart.current = {
          x: posRef.current.x,
          y: posRef.current.y,
        };
      },
      onPanResponderMove: (_, gs) => {
        const dx = gs.dx / containerWidth;
        const dy = gs.dy / containerHeight;
        const newX = Math.max(0, Math.min(
          1 - posRef.current.width, 
          dragStart.current.x + dx
        ));
        const newY = Math.max(0, Math.min(
          1 - posRef.current.height, 
          dragStart.current.y + dy
        ));
        posRef.current = { ...posRef.current, x: newX, y: newY };
        setLocalPos({ ...posRef.current });
      },
      onPanResponderRelease: () => {
        onActivate(null);
        onUpdate({ ...zone, ...posRef.current });
      },
    })
  ).current;

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isActiveRef.current = true;
        onActivate(zone.id);
        resizeStart.current = {
          width: posRef.current.width,
          height: posRef.current.height,
        };
      },
      onPanResponderMove: (_, gs) => {
        const dw = gs.dx / containerWidth;
        const dh = gs.dy / containerHeight;
        const newW = Math.max(MIN_SIZE, Math.min(
          1 - posRef.current.x,
          resizeStart.current.width + dw
        ));
        const newH = Math.max(MIN_SIZE, Math.min(
          1 - posRef.current.y,
          resizeStart.current.height + dh
        ));
        posRef.current = { ...posRef.current, width: newW, height: newH };
        setLocalPos({ ...posRef.current });
      },
      onPanResponderRelease: () => {
        onActivate(null);
        onUpdate({ ...zone, ...posRef.current });
      },
    })
  ).current;

  // Используем локальный стейт для рендера во время перетаскивания
  const renderPos = isActive ? localPos : zone;

  const px = renderPos.x * containerWidth;
  const py = renderPos.y * containerHeight;
  const pw = renderPos.width * containerWidth;
  const ph = renderPos.height * containerHeight;

  return (
    <View style={{
      position: 'absolute',
      left: px,
      top: py,
      width: pw,
      height: ph,
      zIndex: isActive ? 10 : 1,
    }}>
      <View
        {...dragResponder.panHandlers}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          borderWidth: isActive ? 2.5 : 1.5,
          borderColor: zone.color,
          borderRadius: 6,
          backgroundColor: zone.color + (isActive ? '35' : '15'),
        }}
      />
      <View
        {...resizeResponder.panHandlers}
        style={{
          position: 'absolute',
          right: -10,
          bottom: -10,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: zone.color,
          borderWidth: 2,
          borderColor: '#fff',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 10 }}>↔</Text>
      </View>
    </View>
  );
};

export default function DraggableZones({
  containerWidth,
  containerHeight,
  zones,
  onZonesChange,
  mode,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const zonesRef = useRef(zones);
  
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const handleUpdate = (updated: Zone) => {
    const newZones = zonesRef.current.map(
      z => z.id === updated.id ? updated : z
    );
    zonesRef.current = newZones;
    onZonesChange(newZones);
  };

  if (!containerWidth || !containerHeight) return null;

  return (
    <>
      {zones.map(zone => (
        <DraggableZone
          key={zone.id}
          zone={zone}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          onUpdate={handleUpdate}
          onActivate={setActiveId}
          isActive={activeId === zone.id}
        />
      ))}
    </>
  );
}
