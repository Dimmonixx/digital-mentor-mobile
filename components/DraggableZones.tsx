import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

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

const MIN_SIZE_PX = 40;

const HANDLE_SIZE = 24;
const HANDLE_RADIUS = 12;

const HANDLE_STYLES: Record<string, any> = {
  n:  { position: 'absolute', top: -HANDLE_RADIUS, left: '50%', marginLeft: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 30 },
  s:  { position: 'absolute', bottom: -HANDLE_RADIUS, left: '50%', marginLeft: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 30 },
  e:  { position: 'absolute', right: -HANDLE_RADIUS, top: '50%', marginTop: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 30 },
  w:  { position: 'absolute', left: -HANDLE_RADIUS, top: '50%', marginTop: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 30 },
  ne: { position: 'absolute', top: -HANDLE_RADIUS, right: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 35 },
  nw: { position: 'absolute', top: -HANDLE_RADIUS, left: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 35 },
  se: { position: 'absolute', bottom: -HANDLE_RADIUS, right: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 35 },
  sw: { position: 'absolute', bottom: -HANDLE_RADIUS, left: -HANDLE_RADIUS, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_RADIUS, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', zIndex: 35 },
};

type HandlePosition = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  const posRef = useRef({ x: zone.x, y: zone.y, width: zone.width, height: zone.height });

  const isActiveRef = useRef(false);
  isActiveRef.current = isActive;

  if (!isActiveRef.current) {
    posRef.current = { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
  }

  const dragStart = useRef({ x: 0, y: 0 });

  const [localPos, setLocalPos] = useState({
    x: zone.x, y: zone.y, width: zone.width, height: zone.height
  });

  const minW = MIN_SIZE_PX / containerWidth;
  const minH = MIN_SIZE_PX / containerHeight;

  const applyResize = (start: { x: number; y: number; width: number; height: number }, dx: number, dy: number, position: HandlePosition) => {
    let newX = start.x;
    let newY = start.y;
    let newW = start.width;
    let newH = start.height;

    if (position.includes('w')) {
      newX = start.x + dx;
      newW = start.width - dx;
    }
    if (position.includes('e')) {
      newW = start.width + dx;
    }
    if (position.includes('n')) {
      newY = start.y + dy;
      newH = start.height - dy;
    }
    if (position.includes('s')) {
      newH = start.height + dy;
    }

    if (newW < minW) {
      newW = minW;
      if (position.includes('w')) {
        newX = start.x + start.width - minW;
      }
    }
    if (newH < minH) {
      newH = minH;
      if (position.includes('n')) {
        newY = start.y + start.height - minH;
      }
    }

    if (newX < 0) {
      newW = newW + newX;
      newX = 0;
    }
    if (newY < 0) {
      newH = newH + newY;
      newY = 0;
    }
    if (newX + newW > 1) {
      newW = 1 - newX;
    }
    if (newY + newH > 1) {
      newH = 1 - newY;
    }

    if (newW < minW) newW = minW;
    if (newH < minH) newH = minH;

    return { x: newX, y: newY, width: newW, height: newH };
  };

  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const createHandleResponder = (position: HandlePosition) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isActiveRef.current = true;
        onActivate(zone.id);
        resizeStart.current = { ...posRef.current };
      },
      onPanResponderMove: (_, gs) => {
        const dx = gs.dx / containerWidth;
        const dy = gs.dy / containerHeight;
        posRef.current = applyResize(resizeStart.current, dx, dy, position);
        setLocalPos({ ...posRef.current });
      },
      onPanResponderRelease: () => {
        onActivate(null);
        onUpdate({ ...zone, ...posRef.current });
      },
    });

  const handleResponders = useRef<Record<HandlePosition, ReturnType<typeof PanResponder.create>>>({
    n: createHandleResponder('n'),
    s: createHandleResponder('s'),
    e: createHandleResponder('e'),
    w: createHandleResponder('w'),
    ne: createHandleResponder('ne'),
    nw: createHandleResponder('nw'),
    se: createHandleResponder('se'),
    sw: createHandleResponder('sw'),
  }).current;

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
        const newX = clamp(
          dragStart.current.x + dx,
          0,
          1 - posRef.current.width
        );
        const newY = clamp(
          dragStart.current.y + dy,
          0,
          1 - posRef.current.height
        );
        posRef.current = { ...posRef.current, x: newX, y: newY };
        setLocalPos({ ...posRef.current });
      },
      onPanResponderRelease: () => {
        onActivate(null);
        onUpdate({ ...zone, ...posRef.current });
      },
    })
  ).current;

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
      {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as HandlePosition[]).map((pos) => (
        <View
          key={pos}
          {...handleResponders[pos].panHandlers}
          style={HANDLE_STYLES[pos]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      ))}
    </View>
  );
};

export default function DraggableZones({
  containerWidth,
  containerHeight,
  zones,
  onZonesChange,
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
