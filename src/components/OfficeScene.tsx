'use client';

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { AgentModel } from '@/features/retro-office/objects/agents';
import type { RenderAgent } from '@/features/retro-office/core/types';
import { CANVAS_H, CANVAS_W, SCALE } from '@/features/retro-office/core/constants';
import { createDefaultAgentAvatarProfile } from '@/lib/avatars/profile';
import type { Agent, DivisionId } from '@/lib/office/types';

export interface OfficeSceneProps {
  agents: Agent[];
  selectedDivision: DivisionId | 'all';
  onSelectAgent: (id: string) => void;
  overview: boolean;
  resetKey: number;
}

type Room = { id: DivisionId; name: string; short: string; x: number; z: number; color: string; floor: string; wall: string };
const ROOMS: Room[] = [
  { id: 'marketing', name: 'Digital Marketing', short: 'GROWTH STUDIO', x: -4.9, z: -3.35, color: '#47967a', floor: '#dceee3', wall: '#b6d7c2' },
  { id: 'design', name: 'Graphic Design', short: 'CREATIVE STUDIO', x: 4.9, z: -3.35, color: '#9173c5', floor: '#ebe4f5', wall: '#d4c3e8' },
  { id: 'analytics', name: 'Data Analyst', short: 'INSIGHT LAB', x: -4.9, z: 3.25, color: '#5d8eb8', floor: '#deebf5', wall: '#b6d0e3' },
  { id: 'publisher', name: 'Publisher', short: 'CONTENT STUDIO', x: 4.9, z: 3.25, color: '#bf8760', floor: '#f5e6d9', wall: '#e8c7a8' },
];
const STATUS_TEXT: Record<Agent['status'], string> = { idle: 'Siap', working: 'Bekerja', review: 'Review', error: 'Perlu perhatian' };
const STATUS_COLORS: Record<Agent['status'], string> = { idle: '#93a29b', working: '#44a47e', review: '#c4923c', error: '#d36666' };

/** The GLBs are the original, locally served furniture models from Claw3D. */
function Furniture({ name, position, width, height, rotation = 0, tint }: {
  name: string; position: [number, number, number]; width?: number; height?: number; rotation?: number; tint?: string;
}) {
  const { scene } = useGLTF(`/office-assets/models/furniture/${name}.glb`);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const dimensions = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = width ? width / dimensions.x : (height ?? 1) / dimensions.y;
    const scaleY = height ? height / dimensions.y : scale;
    clone.position.set(-center.x * scale, -box.min.y * scaleY, -center.z * scale);
    clone.scale.set(scale, scaleY, scale);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const next = materials.map((material) => {
        const copy = material.clone() as THREE.MeshStandardMaterial;
        if (tint && copy.color) copy.color.lerp(new THREE.Color(tint), 0.84);
        copy.roughness = 0.82;
        copy.metalness = 0;
        return copy;
      });
      child.material = Array.isArray(child.material) ? next : next[0];
    });
    return clone;
  }, [scene, width, height, tint]);
  useEffect(() => () => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }, [model]);
  return <group position={position} rotation={[0, rotation, 0]}><primitive object={model} /></group>;
}

function Block({ position, size, color, radius = 0.045 }: { position: [number, number, number]; size: [number, number, number]; color: string; radius?: number }) {
  return <RoundedBox args={size} radius={radius} smoothness={2} position={position} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.9} /></RoundedBox>;
}

function WallArt({ room }: { room: Room }) {
  return <group position={[room.x, 1.57, room.z - 2.13]}>
    <Block position={[0, 0, 0]} size={[2.5, 1.23, 0.09]} color="#fbfbf7" />
    {room.id === 'analytics' || room.id === 'marketing' ? <>
      {[0.35, 0.58, 0.47, 0.78, 0.95].map((height, i) => <Block key={i} position={[-0.82 + i * 0.41, height / 2 - 0.48, 0.075]} size={[0.24, height, 0.028]} color={i === 4 ? room.color : room.wall} radius={0.008} />)}
    </> : <>
      <Block position={[-0.67, 0.04, 0.07]} size={[0.7, 0.8, 0.026]} color={room.wall} />
      <Block position={[0.12, 0.19, 0.07]} size={[0.48, 0.49, 0.026]} color={room.color} />
      <Block position={[0.68, -0.14, 0.07]} size={[0.48, 0.52, 0.026]} color={room.id === 'design' ? '#e5c49a' : '#b2c8bc'} />
    </>}
  </group>;
}

function Workstation({ x, z, color, reverse = false }: { x: number; z: number; color: string; reverse?: boolean }) {
  return <group position={[x, 0, z]} rotation={[0, reverse ? Math.PI : 0, 0]}>
    <Furniture name="desk" position={[0, 0.03, 0]} width={2.1} height={0.78} tint="#f5efe6" />
    <Furniture name="computerScreen" position={[0.05, 0.81, -0.2]} width={0.68} rotation={Math.PI} tint="#546562" />
    <Block position={[0.05, 0.83, 0.21]} size={[0.62, 0.04, 0.21]} color="#dddeda" radius={0.02} />
    <Block position={[-0.62, 0.835, 0.21]} size={[0.32, 0.025, 0.4]} color={color} radius={0.01} />
    <mesh position={[0.76, 0.91, 0.2]} castShadow><cylinderGeometry args={[0.085, 0.07, 0.18, 12]} /><meshStandardMaterial color="#fbfaf5" /></mesh>
    <Furniture name="chairDesk" position={[0, 0.03, 1.05]} height={0.94} rotation={Math.PI} tint={color} />
  </group>;
}

function DivisionRoom({ room, agents, selected, onSelectAgent }: { room: Room; agents: Agent[]; selected: boolean; onSelectAgent: (id: string) => void }) {
  const working = agents.filter((agent) => agent.status === 'working').length;
  return <group>
    <RoundedBox args={[6.45, 0.11, 5.05]} radius={0.13} smoothness={3} position={[room.x, 0, room.z]} receiveShadow
      onClick={(event) => { event.stopPropagation(); if (agents[0]) onSelectAgent(agents[0].id); }}>
      <meshStandardMaterial color={room.floor} roughness={0.98} emissive={room.color} emissiveIntensity={selected ? 0.11 : 0} />
    </RoundedBox>
    <Block position={[room.x, 0.81, room.z - 2.38]} size={[6.5, 1.62, 0.15]} color={room.wall} />
    <Block position={[room.x, 1.65, room.z - 2.38]} size={[6.55, 0.1, 0.21]} color="#fcfdf8" />
    <Block position={[room.x + (room.x < 0 ? -3.22 : 3.22), 0.44, room.z]} size={[0.15, 0.87, 5.05]} color={room.wall} />
    <WallArt room={room} />
    <Workstation x={room.x - 1.39} z={room.z - 0.45} color={room.color} />
    <Workstation x={room.x + 1.36} z={room.z - 0.45} color={room.color} />
    <Furniture name="pottedPlant" position={[room.x - 2.58, 0.05, room.z - 1.69]} height={1.32} />
    <Furniture name="bookcaseClosed" position={[room.x + 2.5, 0.06, room.z - 1.78]} height={1.39} tint="#e9e8de" />
    <Furniture name="plantSmall1" position={[room.x + 2.47, 1.45, room.z - 1.78]} height={0.35} />
    <Html position={[room.x, 0.15, room.z + 2.24]} center zIndexRange={[20, 0]}>
      <button type="button" onClick={() => { if (agents[0]) onSelectAgent(agents[0].id); }}
        aria-label={`Buka divisi ${room.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '6px 10px', color: '#3c5148', background: selected ? '#ffffff' : '#ffffffee', border: `1px solid ${selected ? room.color : '#ffffff'}`, borderRadius: 7, boxShadow: '0 3px 10px #334d3820', fontFamily: 'inherit', cursor: 'pointer', fontSize: 10, fontWeight: 650 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: room.color }} />
        {room.name}<span style={{ marginLeft: 3, color: '#849089', fontWeight: 500, fontSize: 9 }}>{working ? `${working} bekerja` : `${agents.length} agent`}</span>
      </button>
    </Html>
  </group>;
}

function agentPositions(agents: Agent[]) {
  const seen: Partial<Record<DivisionId, number>> = {};
  const positions = new Map<string, [number, number]>();
  agents.forEach((agent) => {
    const index = seen[agent.division] ?? 0;
    seen[agent.division] = index + 1;
    const room = ROOMS.find((candidate) => candidate.id === agent.division);
    if (!room) positions.set(agent.id, [0, 1.25]);
    else positions.set(agent.id, [room.x + (index % 2 === 0 ? -1.39 : 1.36), room.z + 0.87 + Math.floor(index / 2) * 0.63]);
  });
  return positions;
}

function OfficeAgents({ agents, onSelectAgent, selectedDivision }: Pick<OfficeSceneProps, 'agents' | 'onSelectAgent' | 'selectedDivision'>) {
  const positions = useMemo(() => agentPositions(agents), [agents]);
  const actors = useRef<RenderAgent[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    actors.current = agents.map((agent, index) => {
      const [x, z] = positions.get(agent.id)!;
      return { id: agent.id, name: agent.name, color: agent.color, item: '', status: agent.status === 'review' ? 'idle' : agent.status,
        x: x / SCALE + CANVAS_W / 2, y: z / SCALE + CANVAS_H / 2,
        targetX: x / SCALE + CANVAS_W / 2, targetY: z / SCALE + CANVAS_H / 2,
        path: [], facing: agent.division === 'manager' ? 0.4 : -0.3, frame: 0, walkSpeed: 0, phaseOffset: index * 7, state: 'standing' };
    });
  }, [agents, positions]);
  useFrame((_, delta) => { if (!reducedMotion) actors.current.forEach((agent) => { agent.frame += Math.min(delta, 0.1) * 60; }); });
  const appearances = useMemo(() => new Map(agents.map((agent) => {
    const profile = createDefaultAgentAvatarProfile(agent.id);
    profile.clothing.topColor = agent.color;
    profile.clothing.topStyle = agent.division === 'manager' ? 'jacket' : 'hoodie';
    profile.clothing.bottomColor = '#5f6670';
    profile.clothing.shoesColor = '#f3f0e7';
    profile.accessories.hatStyle = 'none';
    profile.accessories.backpack = false;
    return [agent.id, profile];
  })), [agents]);
  return <>
    {agents.map((agent) => {
      const [x, z] = positions.get(agent.id)!;
      const emphasized = hovered === agent.id || selectedDivision === agent.division;
      return <group key={agent.id}>
        <AgentModel agentId={agent.id} name="" status={agent.status === 'review' ? 'idle' : agent.status}
          color={agent.color} appearance={appearances.get(agent.id)} agentsRef={actors}
          onClick={onSelectAgent} onHover={setHovered} onUnhover={() => setHovered(null)} suppressSpeechBubble />
        <Html position={[x, 1.51, z]} center zIndexRange={[25, 0]}>
          <button type="button" onClick={() => onSelectAgent(agent.id)} aria-label={`${agent.name}, ${agent.role}, ${STATUS_TEXT[agent.status]}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', padding: emphasized ? '5px 8px' : '4px 7px', color: '#4a5b52', background: '#fffffff2', border: `1px solid ${emphasized ? agent.color : '#e5eae4'}`, borderRadius: 5, fontSize: 9, boxShadow: '0 2px 5px #3242310d', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLORS[agent.status] }} />
            {agent.name}{emphasized && <span style={{ color: '#859087', fontWeight: 400 }}>· {STATUS_TEXT[agent.status]}</span>}
          </button>
        </Html>
      </group>;
    })}
  </>;
}

function MeetingArea({ agents, onSelectAgent, selected }: { agents: Agent[]; onSelectAgent: (id: string) => void; selected: boolean }) {
  const manager = agents.find((agent) => agent.division === 'manager');
  return <group>
    <mesh position={[0, 0.085, 0.15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.68, 48]} /><meshStandardMaterial color={selected ? '#d4dfc2' : '#e3e7d6'} roughness={1} /></mesh>
    <Furniture name="tableRound" position={[0, 0.12, -0.12]} width={2.25} height={0.79} tint="#ddd7bd" />
    <Furniture name="chairModernCushion" position={[-1.13, 0.08, 0.45]} height={0.82} rotation={Math.PI / 2} tint="#a5b599" />
    <Furniture name="chairModernCushion" position={[1.14, 0.08, 0.45]} height={0.82} rotation={-Math.PI / 2} tint="#a5b599" />
    <Furniture name="plantSmall1" position={[0, 0.92, -0.32]} height={0.28} />
    <Block position={[-0.51, 0.93, 0.08]} size={[0.44, 0.035, 0.51]} color="#f6f7ee" />
    <Block position={[0.46, 0.93, 0.08]} size={[0.39, 0.035, 0.44]} color="#a3b397" />
    <Html position={[0, 0.13, 2.17]} center zIndexRange={[21, 0]}><button type="button" onClick={() => { if (manager) onSelectAgent(manager.id); }}
      style={{ border: '1px solid #d4dccb', background: '#fffffff0', color: '#53654b', borderRadius: 7, padding: '6px 10px', fontSize: 9, fontFamily: 'inherit', fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 3px 8px #334d3812' }}>Marketing Manager <span style={{ color: '#96a28a', marginLeft: 5, fontSize: 8 }}>HUMAN</span></button></Html>
    <Furniture name="pottedPlant" position={[-0.82, 0.03, -4.65]} height={1.3} />
    <Furniture name="pottedPlant" position={[0.84, 0.03, -4.65]} height={1.3} />
    <Furniture name="loungeSofa" position={[0, 0.03, 5.12]} width={2.35} rotation={Math.PI} tint="#b6c3a7" />
    <Furniture name="tableCoffee" position={[0, 0.03, 4.14]} width={1.36} tint="#e7dcc5" />
    <Furniture name="plantSmall1" position={[0.15, 0.51, 4.14]} height={0.29} />
  </group>;
}

function CameraRig({ overview, resetKey }: Pick<OfficeSceneProps, 'overview' | 'resetKey'>) {
  const { size, invalidate, get } = useThree();
  const controls = useRef<OrbitControlsType>(null);
  useLayoutEffect(() => {
    const camera = get().camera;
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    if (overview) camera.position.set(0, 30, 0.01);
    else camera.position.set(18, 21, 24);
    camera.zoom = overview ? Math.min(size.width / 20, size.height / 16) : Math.min(size.width / 23, size.height / 14);
    camera.lookAt(0, 0.4, 0);
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0.4, 0);
    controls.current?.update();
    invalidate();
  }, [get, size.width, size.height, overview, resetKey, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08} minZoom={12} maxZoom={95} minPolarAngle={0} maxPolarAngle={Math.PI / 2.6} maxAzimuthAngle={Math.PI} minAzimuthAngle={-Math.PI} />;
}

function Scene(props: OfficeSceneProps) {
  return <>
    <color attach="background" args={['#f2f5f0']} />
    <ambientLight intensity={0.65} />
    <hemisphereLight args={['#ffffff', '#d6dfc8', 0.8]} />
    <directionalLight castShadow position={[-9, 18, 10]} intensity={1.8} shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-normalBias={0.025} shadow-bias={-0.0002} />
    <directionalLight position={[8, 6, -10]} intensity={0.4} color="#e6e9ff" />
    <mesh position={[0, -0.68, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#f2f5f0" roughness={1} /></mesh>
    <Block position={[0, -0.37, 0]} size={[17.9, 0.62, 13.25]} color="#e2e7da" radius={0.19} />
    <Block position={[0, -0.09, 0]} size={[17.72, 0.22, 13.05]} color="#faf9f2" radius={0.13} />
    {[-6.4, -5.9, -2.2, -1.7, 0, 1.7, 2.2, 5.9, 6.4].map((z) => <Block key={z} position={[0, 0.029, z]} size={[17.5, 0.005, 0.012]} color="#e6e8df" radius={0.001} />)}
    <Suspense fallback={null}>
      {ROOMS.map((room) => <DivisionRoom key={room.id} room={room} agents={props.agents.filter((agent) => agent.division === room.id)} selected={props.selectedDivision === room.id} onSelectAgent={props.onSelectAgent} />)}
      <MeetingArea agents={props.agents} onSelectAgent={props.onSelectAgent} selected={props.selectedDivision === 'manager'} />
      <OfficeAgents agents={props.agents} selectedDivision={props.selectedDivision} onSelectAgent={props.onSelectAgent} />
      <Furniture name="pottedPlant" position={[-8.1, 0.02, -6]} height={1.6} />
      <Furniture name="pottedPlant" position={[8.1, 0.02, -6]} height={1.6} />
      <Furniture name="lampRoundFloor" position={[-8, 0.02, 0]} height={1.8} tint="#b5a98c" />
      <Furniture name="lampRoundFloor" position={[8, 0.02, 0]} height={1.8} tint="#b5a98c" />
    </Suspense>
    <CameraRig overview={props.overview} resetKey={props.resetKey} />
  </>;
}

function OfficeMap({ agents, onSelectAgent }: Pick<OfficeSceneProps, 'agents' | 'onSelectAgent'>) {
  return <div aria-label="Peta kantor dua dimensi" style={{ height: '100%', minHeight: 330, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, padding: 28, background: '#f2f5f0', alignContent: 'center' }}>
    <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12, color: '#6e7d70' }}>Mode peta · tampilan 3D tidak tersedia di perangkat ini.</p>
    {ROOMS.map((room) => <section key={room.id} style={{ background: room.floor, borderRadius: 12, padding: 18, border: `1px solid ${room.wall}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 13, color: room.color }}>{room.name}</h3>
      {agents.filter((agent) => agent.division === room.id).map((agent) => <button key={agent.id} type="button" onClick={() => onSelectAgent(agent.id)} style={{ display: 'block', border: 0, borderRadius: 6, marginTop: 6, padding: '7px 10px', background: '#ffffffd9', cursor: 'pointer', fontSize: 12, color: '#4a5b52' }}>{agent.name} · {STATUS_TEXT[agent.status]}</button>)}
    </section>)}
    {agents.filter((agent) => agent.division === 'manager').map((agent) => <button key={agent.id} type="button" onClick={() => onSelectAgent(agent.id)} style={{ gridColumn: '1 / -1', background: '#e3e7d6', border: '1px solid #d4dccb', padding: 14, borderRadius: 9, cursor: 'pointer', color: '#53654b' }}>{agent.name} · Marketing Manager (Human)</button>)}
  </div>;
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function OfficeScene(props: OfficeSceneProps) {
  const [contextLost, setContextLost] = useState(false);
  const fallback = <OfficeMap agents={props.agents} onSelectAgent={props.onSelectAgent} />;
  return <div style={{ width: '100%', height: '100%', position: 'relative' }} aria-label="Kantor virtual 3D, empat divisi AI dan Marketing Manager" data-testid="office-scene">
    {contextLost ? fallback : <SceneBoundary fallback={fallback}>
      <Canvas orthographic shadows dpr={[1, 1.6]} camera={{ position: [18, 21, 24], zoom: 30, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={fallback}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); setContextLost(true); }, { once: true });
        }}>
        <Scene {...props} />
      </Canvas>
    </SceneBoundary>}
  </div>;
}
