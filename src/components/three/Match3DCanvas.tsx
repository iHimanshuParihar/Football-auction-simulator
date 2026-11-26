'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CameraMode,
  ClubPreset,
  StadiumTemplate,
  WeatherCondition,
} from '@/types/game';
import { MatchSimulationEngine, SimPlayerState } from '@/lib/match-engine';
import { loadSameOriginClubImage } from '@/lib/club-assets-client';
import {
  createFabricNormalCanvas,
  createJerseyTextureCanvas,
  createPlayerFaceTextureCanvas,
} from '@/lib/svg-generators';

interface Match3DCanvasProps {
  engine: MatchSimulationEngine;
  stadium: StadiumTemplate;
  cameraMode: CameraMode;
  weather: WeatherCondition;
  speedMultiplier: number;
  onTick?: () => void;
}

interface PlayerRig3D {
  currentPlayerId: string;
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  torsoMat: THREE.MeshStandardMaterial;
  faceTex: THREE.CanvasTexture;
  shadowDisc: THREE.Mesh;
  sweatApplied: boolean;
}

function toWorld(x: number, y: number): { wx: number; wz: number } {
  return {
    wx: ((x - 50) / 100) * 105,
    wz: ((y - 50) / 100) * 68,
  };
}

function makeSRGBTexture(
  canvas: HTMLCanvasElement,
  anisotropy = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (anisotropy > 1) tex.anisotropy = anisotropy;
  return tex;
}

function createGrassBumpCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  // Deterministic grass blade micro-grain
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 6500; i++) {
    const x = nextRand() * 256;
    const y = nextRand() * 256;
    const v = Math.floor(85 + nextRand() * 95);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1.4, 3.2);
  }
  return c;
}

function createStarballTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#0f172a';
  const stars = [
    [64, 64], [192, 64], [320, 64], [448, 64],
    [128, 175], [256, 175], [384, 175],
  ];
  for (const [cx, cy] of stars) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const b = a + Math.PI / 5;
      const rOut = 32;
      const rIn = 14;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
      else ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
      ctx.lineTo(cx + Math.cos(b) * rIn, cy + Math.sin(b) * rIn);
    }
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

function createBannerTexture(
  club: ClubPreset,
  subtitle: string,
  badgeImg?: HTMLImageElement | null
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = club.primary;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.36)';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = club.secondary;
  ctx.fillRect(0, 0, 1024, 38);
  ctx.fillRect(0, 218, 1024, 38);
  ctx.fillStyle = club.accent;
  ctx.fillRect(0, 38, 1024, 10);
  ctx.fillRect(0, 208, 1024, 10);

  if (badgeImg) {
    try {
      ctx.drawImage(badgeImg, 54, 62, 132, 132);
      ctx.drawImage(badgeImg, 1024 - 186, 62, 132, 132);
    } catch {
      // ignore
    }
  }

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.lineWidth = 10;
  ctx.font = '900 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(club.name.toUpperCase(), 512, 118);
  ctx.fillText(club.name.toUpperCase(), 512, 118);

  ctx.font = '800 32px sans-serif';
  ctx.fillStyle = club.accent;
  ctx.fillText(subtitle.toUpperCase(), 512, 180);
  return c;
}

function createTurfTexture(
  stadium: StadiumTemplate,
  wearFactor: number,
  homeBadgeImg?: HTMLImageElement | null
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext('2d')!;

  // Richer broadcast emerald base (darker outer apron + rich natural alternating bands)
  ctx.fillStyle = '#0d4722';
  ctx.fillRect(0, 0, c.width, c.height);

  const padX = 56;
  const padY = 42;
  const w = c.width - padX * 2;
  const h = c.height - padY * 2;

  const stripes = 18;
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? stadium.turfToneA : stadium.turfToneB;
    ctx.fillRect(padX + i * sw, padY, sw + 1, h);
  }

  // Cross-mow subtle natural tonal grain
  ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
  for (let y = padY; y < padY + h; y += 64) {
    if (Math.floor((y - padY) / 64) % 2 === 0) ctx.fillRect(padX, y, w, 32);
  }

  // Organic grass blade & soil mottling so pitch has deep rich texture under lights
  let seed = 9001;
  const nextRand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 24000; i++) {
    const gx = nextRand() * c.width;
    const gy = nextRand() * c.height;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(6, 40, 18, 0.16)' : 'rgba(52, 168, 83, 0.09)';
    ctx.fillRect(gx, gy, 3, 2);
  }

  // Subtle mowed grass apron just outside touchlines
  ctx.strokeStyle = 'rgba(10, 56, 26, 0.55)';
  ctx.lineWidth = 18;
  ctx.strokeRect(padX - 18, padY - 18, w + 36, h + 36);

  // Progressive penalty-box & midfield turf scuffing
  if (wearFactor > 0.05) {
    const spots = [
      [140, 512],
      [1908, 512],
      [1024, 512],
    ];
    for (const [sx, sy] of spots) {
      const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 145);
      grad.addColorStop(0, `rgba(68, 49, 26, ${wearFactor * 0.45})`);
      grad.addColorStop(1, 'rgba(68, 49, 26, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, 145, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Crisp UEFA chalk pitch markings (natural chalk white without neon bloom)
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.9)';
  ctx.lineWidth = 6;
  ctx.strokeRect(padX, padY, w, h);

  // Halfway line + center circle + subtle home crest emblem
  if (homeBadgeImg) {
    try {
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.drawImage(homeBadgeImg, c.width / 2 - 74, c.height / 2 - 74, 148, 148);
      ctx.restore();
    } catch {
      // ignore
    }
  }
  ctx.beginPath();
  ctx.moveTo(c.width / 2, padY);
  ctx.lineTo(c.width / 2, padY + h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c.width / 2, c.height / 2, 130, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
  ctx.beginPath();
  ctx.arc(c.width / 2, c.height / 2, 9, 0, Math.PI * 2);
  ctx.fill();

  // Penalty boxes + spots
  const boxW = w * 0.157;
  const boxH = h * 0.59;
  const boxY = (c.height - boxH) / 2;
  ctx.strokeRect(padX, boxY, boxW, boxH);
  ctx.strokeRect(padX + w - boxW, boxY, boxW, boxH);

  ctx.beginPath();
  ctx.arc(padX + w * 0.105, c.height / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(padX + w - w * 0.105, c.height / 2, 7, 0, Math.PI * 2);
  ctx.fill();

  // 6-yard boxes
  const sixW = w * 0.052;
  const sixH = h * 0.27;
  const sixY = (c.height - sixH) / 2;
  ctx.strokeRect(padX, sixY, sixW, sixH);
  ctx.strokeRect(padX + w - sixW, sixY, sixW, sixH);

  // Penalty arcs & corner quadrants
  ctx.beginPath();
  ctx.arc(padX + w * 0.105, c.height / 2, 125, -0.68, 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padX + w - w * 0.105, c.height / 2, 125, Math.PI - 0.68, Math.PI + 0.68);
  ctx.stroke();

  for (const [cx, cy, sa, ea] of [
    [padX, padY, 0, Math.PI / 2],
    [padX + w, padY, Math.PI / 2, Math.PI],
    [padX + w, padY + h, Math.PI, Math.PI * 1.5],
    [padX, padY + h, Math.PI * 1.5, Math.PI * 2],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 24, sa, ea);
    ctx.stroke();
  }

  return c;
}

function createLedBoardTexture(
  homeCode: string,
  awayCode: string,
  homeGoals: number,
  awayGoals: number,
  stadiumName: string
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, 1024, 128);

  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e3a8a');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 8, 1024, 112);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 8, 1024, 6);
  ctx.fillRect(0, 114, 1024, 6);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 42px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `UCL LIVE • ${homeCode} ${homeGoals} - ${awayGoals} ${awayCode} • ${stadiumName.toUpperCase()} • `,
    28,
    64
  );
  return c;
}

function buildHumanoidRig(
  sp: SimPlayerState,
  clubPrimary: string,
  clubSecondary: string,
  clubAccent: string,
  clubCode: string,
  clubPattern: string,
  normalTex: THREE.Texture,
  isReferee = false
): PlayerRig3D {
  const group = new THREE.Group();
  const heightScale = sp.player.appearance.heightM / 1.8;
  const musc = sp.player.appearance.muscularity;
  group.scale.set(musc, heightScale, musc);

  const kitCanvas = isReferee
    ? (() => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(0, 0, 256, 256);
        return c;
      })()
    : createJerseyTextureCanvas(
        {
          id: 'kit',
          name: clubCode,
          code: clubCode,
          primary: clubPrimary,
          secondary: clubSecondary,
          accent: clubAccent,
          pattern: clubPattern as never,
          stadium: 'etihad',
          city: '',
          crestShape: 'circle',
          crestMotif: 'star',
        },
        sp.player.name,
        sp.player.squadNumber,
        0,
        sp.slotIndex === 0
      );

  const kitTex = makeSRGBTexture(kitCanvas);
  const faceTex = makeSRGBTexture(createPlayerFaceTextureCanvas(sp.player));
  const torsoMat = new THREE.MeshStandardMaterial({
    map: kitTex,
    bumpMap: normalTex,
    bumpScale: 0.014,
    roughness: 0.65,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: isReferee ? '#111827' : sp.slotIndex === 0 ? '#064e3b' : clubSecondary,
    roughness: 0.72,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: sp.player.appearance.skinTone,
    roughness: 0.55,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    roughness: 0.52,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: sp.player.appearance.hairColor,
    roughness: 0.85,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: isReferee ? '#111827' : clubPrimary,
    roughness: 0.72,
  });

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.24), shortsMat);
  pelvis.position.y = 0.88;
  pelvis.castShadow = true;
  group.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.54, 16), torsoMat);
  torso.position.y = 1.24;
  torso.rotation.y = -Math.PI / 2;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.148, 18, 14), faceMat);
  head.position.y = 1.66;
  head.rotation.y = -Math.PI / 2;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    sp.player.appearance.hairStyle === 'curly_afro'
      ? new THREE.SphereGeometry(0.165, 10, 10)
      : new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hair.position.y = 1.68;
  group.add(hair);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 1.44, 0);
  const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.46, 8), skinMat);
  lArmMesh.position.y = -0.22;
  leftArm.add(lArmMesh);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 1.44, 0);
  const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.46, 8), skinMat);
  rArmMesh.position.y = -0.22;
  rightArm.add(rArmMesh);
  group.add(rightArm);

  // Jointed Legs (Hip -> Thigh -> Knee Pivot -> Shin + Sock + Boot)
  const makeLeg = (xOff: number) => {
    const leg = new THREE.Group();
    leg.position.set(xOff, 0.82, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.064, 0.4, 8), shortsMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    leg.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.4;
    leg.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.046, 0.16, 8), skinMat);
    shin.position.y = -0.08;
    knee.add(shin);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.22, 8), sockMat);
    sock.position.y = -0.25;
    sock.castShadow = true;
    knee.add(sock);
    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.22),
      new THREE.MeshStandardMaterial({ color: isReferee ? '#000000' : clubAccent })
    );
    boot.position.set(0, -0.38, 0.04);
    knee.add(boot);
    return { leg, knee };
  };

  const left = makeLeg(-0.11);
  const right = makeLeg(0.11);
  group.add(left.leg, right.leg);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.36,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;

  return {
    currentPlayerId: sp.id,
    group,
    leftLeg: left.leg,
    rightLeg: right.leg,
    leftKnee: left.knee,
    rightKnee: right.knee,
    leftArm,
    rightArm,
    torsoMat,
    faceTex,
    shadowDisc,
    sweatApplied: false,
  };
}

export const Match3DCanvas: React.FC<Match3DCanvasProps> = ({
  engine,
  stadium,
  cameraMode,
  weather,
  speedMultiplier,
  onTick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraModeRef = useRef(cameraMode);
  const speedRef = useRef(speedMultiplier);
  const onTickRef = useRef(onTick);
  const [fallback2D, setFallback2D] = useState(false);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    speedRef.current = speedMultiplier;
    onTickRef.current = onTick;
  }, [cameraMode, speedMultiplier, onTick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      queueMicrotask(() => setFallback2D(true));
      return;
    }

    const w = container.clientWidth || 960;
    const h = container.clientHeight || 540;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020510');
    scene.fog = new THREE.FogExp2('#030816', weather === 'heavy_rain' ? 0.003 : 0.0012);

    const camera = new THREE.PerspectiveCamera(46, w / h, 0.5, 480);
    camera.position.set(0, 32, 48);

    // Persistent smooth camera crane state
    const camPosCurrent = new THREE.Vector3(0, 32, 48);
    const camLookCurrent = new THREE.Vector3(0, 1, 0);
    const smoothedBall = new THREE.Vector3(0, 0.25, 0);
    let camFovCurrent = 46;
    let prevCamMode: CameraMode = cameraModeRef.current;
    let transitionBlend = 1;
    const transitionStartPos = camPosCurrent.clone();
    const transitionStartLook = camLookCurrent.clone();
    let transitionStartFov = 46;
    let gkPovSide = 1;

    // Night Starfield Dome
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.42;
      const rad = 220;
      starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * rad;
      starPos[i * 3 + 1] = Math.cos(phi) * rad + 20;
      starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * rad;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: '#e2e8f0', size: 0.9, transparent: true, opacity: 0.7 })
      )
    );

    // Broadcast UCL Night Floodlighting (High-Contrast Key + Balanced Corner Towers)
    scene.add(new THREE.AmbientLight('#60a5fa', 0.22));
    scene.add(new THREE.HemisphereLight('#93c5fd', '#052e16', 0.32));

    const mainSun = new THREE.DirectionalLight('#fffbeb', 1.45);
    mainSun.position.set(-36, 62, 34);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.set(2048, 2048);
    mainSun.shadow.camera.left = -64;
    mainSun.shadow.camera.right = 64;
    mainSun.shadow.camera.top = 46;
    mainSun.shadow.camera.bottom = -46;
    mainSun.shadow.camera.near = 10;
    mainSun.shadow.camera.far = 160;
    mainSun.shadow.bias = -0.0005;
    scene.add(mainSun);

    const towerCoords = [
      [-64, 42, -44],
      [64, 42, -44],
      [-64, 42, 44],
      [64, 42, 44],
    ];
    for (const [tx, ty, tz] of towerCoords) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 1.05, ty, 10),
        new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.78, roughness: 0.35 })
      );
      pole.position.set(tx, ty / 2, tz);
      scene.add(pole);

      const bank = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 2.8, 1.0),
        new THREE.MeshBasicMaterial({ color: stadium.floodlightTint })
      );
      bank.position.set(tx, ty, tz);
      bank.lookAt(0, 0, 0);
      scene.add(bank);

      const spot = new THREE.SpotLight(stadium.floodlightTint, 3400, 220, Math.PI / 3.2, 0.58, 2.0);
      spot.position.set(tx, ty, tz);
      spot.target.position.set(0, 0, 0);
      scene.add(spot);
      scene.add(spot.target);
    }

    // Dark UEFA Stadium Runoff Track Apron (frames crisp green grass pitch)
    const apronMat = new THREE.MeshStandardMaterial({
      color: '#081b33',
      roughness: 0.88,
      metalness: 0.05,
    });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(148, 98), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.03;
    apron.receiveShadow = true;
    scene.add(apron);

    // Anisotropic Turf Pitch + Micro Grass Blade Bump Map
    const turfCanvas = createTurfTexture(stadium, 0);
    const turfTex = makeSRGBTexture(turfCanvas, 8);
    const grassBumpTex = new THREE.CanvasTexture(createGrassBumpCanvas());
    grassBumpTex.wrapS = THREE.RepeatWrapping;
    grassBumpTex.wrapT = THREE.RepeatWrapping;
    grassBumpTex.repeat.set(28, 18);

    const pitchMat = new THREE.MeshStandardMaterial({
      map: turfTex,
      bumpMap: grassBumpTex,
      bumpScale: 0.045,
      roughness: weather.includes('rain') ? 0.38 : 0.88,
      metalness: weather.includes('rain') ? 0.1 : 0.0,
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(114, 76), pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Stepped Two-Tier Stadium Bowl + Cantilever Roof Trusses + Scoreboards
    const seatDarkColor = new THREE.Color(stadium.seatColor).multiplyScalar(0.52);
    const standMat = new THREE.MeshStandardMaterial({
      color: seatDarkColor,
      roughness: 0.86,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.9,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(stadium.roofColor).multiplyScalar(0.72),
      metalness: 0.6,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95,
    });
    const trussMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      metalness: 0.72,
      roughness: 0.38,
    });
    const trimGlowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

    const buildSteppedSide = (
      length: number,
      innerDist: number,
      alongZ: boolean,
      sign: number
    ) => {
      // Lower 5 riser steps (y = 1.6..8.4) + Upper 5 riser steps (y = 10.6..17.4)
      for (let r = 0; r < 5; r++) {
        const y1 = 1.2 + r * 1.45;
        const d1 = innerDist + r * 2.2;
        const step1 = new THREE.Mesh(
          alongZ ? new THREE.BoxGeometry(length, 1.45, 2.3) : new THREE.BoxGeometry(2.3, 1.45, length),
          r % 2 === 0 ? standMat : concreteMat
        );
        if (alongZ) step1.position.set(0, y1 * 0.5, sign * d1);
        else step1.position.set(sign * d1, y1 * 0.5, 0);
        step1.receiveShadow = true;
        scene.add(step1);

        const y2 = 10.2 + r * 1.5;
        const d2 = innerDist + 11.2 + r * 2.2;
        const step2 = new THREE.Mesh(
          alongZ ? new THREE.BoxGeometry(length + 4, 1.5, 2.3) : new THREE.BoxGeometry(2.3, 1.5, length + 4),
          r % 2 === 0 ? standMat : concreteMat
        );
        if (alongZ) step2.position.set(0, y2 - 0.75, sign * d2);
        else step2.position.set(sign * d2, y2 - 0.75, 0);
        scene.add(step2);
      }

      // Tier Fascia + Cantilever Roof + Glowing LED Under-Roof Strip
      const fasciaDist = innerDist + 10.2;
      const fascia = new THREE.Mesh(
        alongZ ? new THREE.BoxGeometry(length + 2, 1.4, 0.8) : new THREE.BoxGeometry(0.8, 1.4, length + 2),
        concreteMat
      );
      if (alongZ) fascia.position.set(0, 9.0, sign * fasciaDist);
      else fascia.position.set(sign * fasciaDist, 9.0, 0);
      scene.add(fascia);

      const roofDist = innerDist + 13.5;
      const roof = new THREE.Mesh(
        alongZ ? new THREE.BoxGeometry(length + 10, 1.4, 24) : new THREE.BoxGeometry(24, 1.4, length + 10),
        roofMat
      );
      if (alongZ) roof.position.set(0, 22.5, sign * roofDist);
      else roof.position.set(sign * roofDist, 22.5, 0);
      scene.add(roof);

      const rimStrip = new THREE.Mesh(
        alongZ ? new THREE.BoxGeometry(length + 6, 0.28, 0.35) : new THREE.BoxGeometry(0.35, 0.28, length + 6),
        trimGlowMat
      );
      if (alongZ) rimStrip.position.set(0, 21.7, sign * (roofDist - 11.6));
      else rimStrip.position.set(sign * (roofDist - 11.6), 21.7, 0);
      scene.add(rimStrip);

      // Steel Roof Trusses
      for (let t = -3; t <= 3; t++) {
        const offset = t * (length / 7);
        const truss = new THREE.Mesh(
          alongZ ? new THREE.BoxGeometry(0.8, 0.8, 24) : new THREE.BoxGeometry(24, 0.8, 0.8),
          trussMat
        );
        if (alongZ) truss.position.set(offset, 21.8, sign * roofDist);
        else truss.position.set(sign * roofDist, 21.8, offset);
        scene.add(truss);
      }
    };

    buildSteppedSide(122, 39.5, true, -1);
    buildSteppedSide(122, 39.5, true, 1);
    buildSteppedSide(78, 56.5, false, -1);
    buildSteppedSide(78, 56.5, false, 1);

    // Behind-Goal Home & Away Supporter Tifos / Banners
    const homeBannerTex = makeSRGBTexture(
      createBannerTexture(engine.teams[0].club, `${stadium.name} • HOME`)
    );
    const awayBannerTex = makeSRGBTexture(
      createBannerTexture(engine.teams[1].club, 'AWAY SUPPORTERS')
    );
    const homeTifo = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 6.2),
      new THREE.MeshBasicMaterial({ map: homeBannerTex })
    );
    homeTifo.position.set(-66.5, 9.2, 0);
    homeTifo.rotation.y = Math.PI / 2;
    scene.add(homeTifo);

    const awayTifo = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 6.2),
      new THREE.MeshBasicMaterial({ map: awayBannerTex })
    );
    awayTifo.position.set(66.5, 9.2, 0);
    awayTifo.rotation.y = -Math.PI / 2;
    scene.add(awayTifo);

    // Animated Waving 3D Corner Flags & Roof Stadium Flags
    const wavingFlags: Array<{ mesh: THREE.Mesh; baseX: number[]; phase: number }> = [];
    const cornerCoords = [
      [-52.5, -34],
      [52.5, -34],
      [-52.5, 34],
      [52.5, 34],
    ];
    for (let idx = 0; idx < cornerCoords.length; idx++) {
      const [cx, cz] = cornerCoords[idx];
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0' })
      );
      pole.position.set(cx, 0.8, cz);
      scene.add(pole);

      const flagGeo = new THREE.PlaneGeometry(0.75, 0.45, 6, 3);
      const flagColor = idx % 2 === 0 ? engine.teams[0].club.primary : engine.teams[0].club.accent;
      const flag = new THREE.Mesh(
        flagGeo,
        new THREE.MeshStandardMaterial({ color: flagColor, side: THREE.DoubleSide })
      );
      flag.position.set(cx + 0.38, 1.36, cz);
      scene.add(flag);
      const posArr = flagGeo.attributes.position as THREE.BufferAttribute;
      wavingFlags.push({
        mesh: flag,
        baseX: Array.from({ length: posArr.count }, (_, k) => posArr.getZ(k)),
        phase: idx * 1.3,
      });
    }

    // 12 Stadium Roof Team Flags (Home & Away Colors)
    for (let f = 0; f < 12; f++) {
      const fx = -50 + f * 9;
      const fz = f % 2 === 0 ? -42 : 42;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 5, 6),
        concreteMat
      );
      pole.position.set(fx, 25, fz);
      scene.add(pole);

      const fGeo = new THREE.PlaneGeometry(3.2, 1.8, 6, 3);
      const fColor = f < 8 ? engine.teams[0].club.primary : engine.teams[1].club.primary;
      const fMesh = new THREE.Mesh(
        fGeo,
        new THREE.MeshStandardMaterial({ color: fColor, side: THREE.DoubleSide, roughness: 0.7 })
      );
      fMesh.position.set(fx + 1.6, 26.6, fz);
      scene.add(fMesh);
      const posArr = fGeo.attributes.position as THREE.BufferAttribute;
      wavingFlags.push({
        mesh: fMesh,
        baseX: Array.from({ length: posArr.count }, (_, k) => posArr.getZ(k)),
        phase: f * 0.9,
      });
    }

    // GPU-Instanced 16,000 Realistic Two-Part Fans (Torso + Head + Overhead Scarves)
    const CROWD_COUNT = 16000;
    const SCARF_COUNT = 2400;
    const fanBodyGeo = new THREE.BoxGeometry(0.46, 0.56, 0.32);
    const fanHeadGeo = new THREE.BoxGeometry(0.22, 0.24, 0.22);
    const fanScarfGeo = new THREE.BoxGeometry(0.72, 0.14, 0.08);
    const fanMat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.02 });
    const crowdBodyMesh = new THREE.InstancedMesh(fanBodyGeo, fanMat, CROWD_COUNT);
    const crowdHeadMesh = new THREE.InstancedMesh(fanHeadGeo, fanMat, CROWD_COUNT);
    const crowdScarfMesh = new THREE.InstancedMesh(fanScarfGeo, fanMat, SCARF_COUNT);
    const crowdBasePos = new Float32Array(CROWD_COUNT * 3);
    const crowdRotY = new Float32Array(CROWD_COUNT);
    const scarfBasePos = new Float32Array(SCARF_COUNT * 3);
    const dummy = new THREE.Object3D();

    // Tone down ultra-bright whites on jerseys so fans look realistic under night lights
    const tameFabricColor = (hex: string) => {
      const c = new THREE.Color(hex);
      const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
      if (lum > 0.72) c.multiplyScalar(0.62);
      return c;
    };
    const homeColor = tameFabricColor(engine.teams[0].club.primary);
    const awayColor = tameFabricColor(engine.teams[1].club.primary);
    const accentColor = tameFabricColor(engine.teams[0].club.accent);
    const jacketColors = [
      new THREE.Color('#1e293b'),
      new THREE.Color('#0f172a'),
      new THREE.Color('#334155'),
      new THREE.Color('#3f3f46'),
    ];
    const headColors = [
      new THREE.Color('#e0ac69'),
      new THREE.Color('#c68642'),
      new THREE.Color('#8d5524'),
      new THREE.Color('#475569'),
      new THREE.Color('#1e293b'),
    ];

    for (let i = 0; i < CROWD_COUNT; i++) {
      const side = i % 4;
      const tierSet = (i >> 2) % 2; // 0 = lower tier (rows 0-4), 1 = upper tier (rows 0-4)
      const row = (i * 7) % 5;
      let sx = 0;
      let sz = 0;
      // Place strictly ON TOP of stepped terraces
      const sy = tierSet === 0 ? 1.7 + row * 0.72 : 10.6 + row * 1.5;
      const depthOff = tierSet === 0 ? row * 2.2 : 11.2 + row * 2.2;
      if (side < 2) {
        sx = ((i * 23.17) % 116) - 58;
        sz = (side === 0 ? -1 : 1) * (39.5 + depthOff);
      } else {
        sx = (side === 2 ? -1 : 1) * (56.5 + depthOff);
        sz = ((i * 17.43) % 74) - 37;
      }
      crowdBasePos[i * 3] = sx;
      crowdBasePos[i * 3 + 1] = sy;
      crowdBasePos[i * 3 + 2] = sz;
      crowdRotY[i] = Math.atan2(-sx, -sz);

      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(0, crowdRotY[i], 0);
      dummy.updateMatrix();
      crowdBodyMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(sx, sy + 0.42, sz);
      dummy.updateMatrix();
      crowdHeadMesh.setMatrixAt(i, dummy.matrix);

      const pick = i % 10;
      const shirtColor =
        sx > 28
          ? pick < 5
            ? awayColor
            : pick < 8
              ? jacketColors[i % 4]
              : accentColor
          : pick < 5
            ? homeColor
            : pick < 8
              ? jacketColors[i % 4]
              : pick === 8
                ? accentColor
                : awayColor;
      crowdBodyMesh.setColorAt(i, shirtColor);
      crowdHeadMesh.setColorAt(i, headColors[i % headColors.length]);

      if (i < SCARF_COUNT) {
        scarfBasePos[i * 3] = sx;
        scarfBasePos[i * 3 + 1] = sy + 0.75;
        scarfBasePos[i * 3 + 2] = sz;
        dummy.position.set(sx, sy + 0.75, sz);
        dummy.lookAt(0, sy + 0.75, 0);
        dummy.updateMatrix();
        crowdScarfMesh.setMatrixAt(i, dummy.matrix);
        crowdScarfMesh.setColorAt(i, sx > 28 ? awayColor : pick % 3 === 0 ? accentColor : homeColor);
      }
    }
    crowdBodyMesh.instanceMatrix.needsUpdate = true;
    if (crowdBodyMesh.instanceColor) crowdBodyMesh.instanceColor.needsUpdate = true;
    crowdHeadMesh.instanceMatrix.needsUpdate = true;
    if (crowdHeadMesh.instanceColor) crowdHeadMesh.instanceColor.needsUpdate = true;
    crowdScarfMesh.instanceMatrix.needsUpdate = true;
    if (crowdScarfMesh.instanceColor) crowdScarfMesh.instanceColor.needsUpdate = true;
    scene.add(crowdBodyMesh, crowdHeadMesh, crowdScarfMesh);

    // Camera Flashes in the Stands
    const FLASH_COUNT = 85;
    const flashPos = new Float32Array(FLASH_COUNT * 3);
    for (let i = 0; i < FLASH_COUNT; i++) {
      const idx = Math.floor((i * CROWD_COUNT) / FLASH_COUNT);
      flashPos[i * 3] = crowdBasePos[idx * 3];
      flashPos[i * 3 + 1] = crowdBasePos[idx * 3 + 1] + 0.6;
      flashPos[i * 3 + 2] = crowdBasePos[idx * 3 + 2];
    }
    const flashGeo = new THREE.BufferGeometry();
    flashGeo.setAttribute('position', new THREE.BufferAttribute(flashPos, 3));
    const flashMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.7,
      transparent: true,
      opacity: 0.15,
    });
    const flashPoints = new THREE.Points(flashGeo, flashMat);
    scene.add(flashPoints);

    // Perimeter LED Ad Boards (North, South & Behind Both Goal Ends)
    const ledCanvas = createLedBoardTexture(
      engine.teams[0].club.code,
      engine.teams[1].club.code,
      0,
      0,
      stadium.name
    );
    const ledTex = makeSRGBTexture(ledCanvas);
    ledTex.wrapS = THREE.RepeatWrapping;
    const ledMat = new THREE.MeshBasicMaterial({ map: ledTex });
    const ledNorth = new THREE.Mesh(new THREE.PlaneGeometry(108, 1.3), ledMat);
    ledNorth.position.set(0, 0.7, -36.5);
    scene.add(ledNorth);
    const ledSouth = new THREE.Mesh(new THREE.PlaneGeometry(108, 1.3), ledMat);
    ledSouth.position.set(0, 0.7, 36.5);
    ledSouth.rotation.y = Math.PI;
    scene.add(ledSouth);
    for (const gx of [-55.5, 55.5]) {
      const rotY = gx < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const gz of [-21, 21]) {
        const endLed = new THREE.Mesh(new THREE.PlaneGeometry(26, 1.3), ledMat);
        endLed.position.set(gx, 0.7, gz);
        endLed.rotation.y = rotY;
        scene.add(endLed);
      }
    }

    // Goalposts + Curved Stanchions + Spring-Mass 24x12 Goal Net Meshes
    const postMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.48, roughness: 0.28 });
    const stanchionMat = new THREE.MeshStandardMaterial({
      color: engine.teams[0].club.accent,
      metalness: 0.5,
      roughness: 0.4,
    });
    const netGeoLeft = new THREE.PlaneGeometry(7.32, 2.44, 23, 11);
    const netGeoRight = new THREE.PlaneGeometry(7.32, 2.44, 23, 11);
    const netMat = new THREE.MeshBasicMaterial({
      color: '#cbd5e1',
      wireframe: true,
      transparent: true,
      opacity: 0.58,
    });
    const netMeshes: [THREE.Mesh, THREE.Mesh] = [
      new THREE.Mesh(netGeoLeft, netMat),
      new THREE.Mesh(netGeoRight, netMat),
    ];

    for (let g = 0; g < 2; g++) {
      const gx = g === 0 ? -52.5 : 52.5;
      const depthDir = g === 0 ? -1 : 1;
      for (const gz of [-3.66, 3.66]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.44, 10), postMat);
        post.position.set(gx, 1.22, gz);
        post.castShadow = true;
        scene.add(post);

        const rearPole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.44, 8), stanchionMat);
        rearPole.position.set(gx + depthDir * 2.1, 1.22, gz);
        scene.add(rearPole);

        const groundBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.06), stanchionMat);
        groundBar.position.set(gx + depthDir * 1.05, 0.04, gz);
        scene.add(groundBar);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7.5, 10), postMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(gx, 2.44, 0);
      bar.castShadow = true;
      scene.add(bar);

      const netMesh = netMeshes[g];
      netMesh.position.set(gx + depthDir * 2.1, 1.22, 0);
      netMesh.rotation.y = g === 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(netMesh);

      const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 7.32, 6, 16), netMat);
      roofNet.position.set(gx + depthDir * 1.05, 2.44, 0);
      roofNet.rotation.x = Math.PI / 2;
      scene.add(roofNet);
      for (const sz of [-3.66, 3.66]) {
        const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.44, 6, 8), netMat);
        sideNet.position.set(gx + depthDir * 1.05, 1.22, sz);
        scene.add(sideNet);
      }
    }

    // Player Tunnel Archway & Technical Dugout Benches
    const tunnel = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 3.6, 5),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 })
    );
    tunnel.position.set(0, 1.8, -38.5);
    scene.add(tunnel);
    const tunnelTrim = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.35, 0.4),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    tunnelTrim.position.set(0, 3.5, -36.0);
    scene.add(tunnelTrim);

    for (const bx of [-12, 12]) {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 2.1, 1.8),
        new THREE.MeshStandardMaterial({
          color: bx < 0 ? engine.teams[0].club.primary : engine.teams[1].club.primary,
          transparent: true,
          opacity: 0.72,
        })
      );
      bench.position.set(bx, 1.05, -38.2);
      scene.add(bench);
    }

    // Goal Celebration Fireworks / Confetti Burst System
    const CONFETTI_COUNT = 260;
    const confettiPos = new Float32Array(CONFETTI_COUNT * 3);
    const confettiVel = new Float32Array(CONFETTI_COUNT * 3);
    const confettiGeo = new THREE.BufferGeometry();
    confettiGeo.setAttribute('position', new THREE.BufferAttribute(confettiPos, 3));
    const confettiMat = new THREE.PointsMaterial({
      color: '#facc15',
      size: 0.55,
      transparent: true,
      opacity: 0.9,
    });
    const confettiPoints = new THREE.Points(confettiGeo, confettiMat);
    confettiPoints.visible = false;
    scene.add(confettiPoints);
    let confettiActiveTimer = 0;
    let prevGoalCount = 0;

    // 22 Articulated Players + 1 Match Referee + 2 Assistant Referees
    const normalTex = new THREE.CanvasTexture(createFabricNormalCanvas());
    const playerRigs = new Map<string, PlayerRig3D>();
    for (const sp of engine.players) {
      const club = engine.teams[sp.teamIdx].club;
      const rig = buildHumanoidRig(
        sp,
        club.primary,
        club.secondary,
        club.accent,
        club.code,
        club.pattern,
        normalTex
      );
      scene.add(rig.group);
      scene.add(rig.shadowDisc);
      playerRigs.set(`${sp.teamIdx}_${sp.slotIndex}`, rig);
    }

    const teamAssets: Array<{
      badgeImg: HTMLImageElement | null;
      jerseyImg: HTMLImageElement | null;
    }> = [
      { badgeImg: null, jerseyImg: null },
      { badgeImg: null, jerseyImg: null },
    ];
    let sceneDisposed = false;
    Promise.all([
      loadSameOriginClubImage(engine.teams[0].club.name, 'badge'),
      loadSameOriginClubImage(engine.teams[0].club.name, 'jersey'),
      loadSameOriginClubImage(engine.teams[1].club.name, 'badge'),
      loadSameOriginClubImage(engine.teams[1].club.name, 'jersey'),
    ]).then(([b0, j0, b1, j1]) => {
      if (sceneDisposed) return;
      teamAssets[0] = { badgeImg: b0, jerseyImg: j0 };
      teamAssets[1] = { badgeImg: b1, jerseyImg: j1 };

      if (b0) {
        homeBannerTex.image = createBannerTexture(engine.teams[0].club, `${stadium.name} • HOME`, b0);
        homeBannerTex.needsUpdate = true;
        turfTex.image = createTurfTexture(stadium, engine.getMinute() >= 60 ? 0.78 : 0, b0);
        turfTex.needsUpdate = true;
      }
      if (b1) {
        awayBannerTex.image = createBannerTexture(engine.teams[1].club, 'AWAY SUPPORTERS', b1);
        awayBannerTex.needsUpdate = true;
      }

      if (b0 || j0 || b1 || j1) {
        for (const sp of engine.players) {
          const rig = playerRigs.get(`${sp.teamIdx}_${sp.slotIndex}`);
          if (!rig) continue;
          const club = engine.teams[sp.teamIdx].club;
          const assets = teamAssets[sp.teamIdx];
          if (!assets.badgeImg && !assets.jerseyImg) continue;
          rig.torsoMat.map = makeSRGBTexture(
            createJerseyTextureCanvas(
              club,
              sp.player.name,
              sp.player.squadNumber,
              engine.getMinute() >= 60 ? 0.65 : 0,
              sp.slotIndex === 0,
              assets.badgeImg,
              assets.jerseyImg
            )
          );
          rig.torsoMat.needsUpdate = true;
        }
      }
    });

    // Illuminated 3D Set-Piece Spot Marker (Throw-In / Corner / Free Kick / Penalty)
    const setPieceRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.15, 28),
      new THREE.MeshBasicMaterial({
        color: '#facc15',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    setPieceRing.rotation.x = -Math.PI / 2;
    setPieceRing.position.y = 0.05;
    setPieceRing.visible = false;
    scene.add(setPieceRing);

    // 3D Virtual VAR Offside Lines (Attacker + Defender) & Touchline VAR Monitor Stand
    const varLineMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 68),
      new THREE.MeshBasicMaterial({
        color: '#ef4444',
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    varLineMesh.rotation.x = -Math.PI / 2;
    varLineMesh.position.y = 0.05;
    varLineMesh.visible = false;
    scene.add(varLineMesh);

    const varDefLineMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 68),
      new THREE.MeshBasicMaterial({
        color: '#3b82f6',
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      })
    );
    varDefLineMesh.rotation.x = -Math.PI / 2;
    varDefLineMesh.position.y = 0.045;
    varDefLineMesh.visible = false;
    scene.add(varDefLineMesh);

    const varMonitorStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.45, 0.18),
      concreteMat
    );
    varMonitorStand.position.set(0, 0.72, -37.2);
    scene.add(varMonitorStand);

    const varMonitorScreen = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.72, 0.12),
      new THREE.MeshBasicMaterial({ color: '#0ea5e9' })
    );
    varMonitorScreen.position.set(0, 1.55, -37.2);
    scene.add(varMonitorScreen);

    const refSample = engine.players[0];
    const refRig = buildHumanoidRig(
      { ...refSample, player: { ...refSample.player, name: 'Referee', squadNumber: 0 } },
      '#facc15', '#111827', '#000000', 'REF', 'solid', normalTex, true
    );
    const refCardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.3, 0.03),
      new THREE.MeshBasicMaterial({ color: '#facc15' })
    );
    refCardMesh.position.set(0.28, 2.08, 0.14);
    refCardMesh.visible = false;
    refRig.group.add(refCardMesh);

    const ar1Rig = buildHumanoidRig(
      { ...refSample, player: { ...refSample.player, name: 'AR1', squadNumber: 0 } },
      '#facc15', '#111827', '#000000', 'AR1', 'solid', normalTex, true
    );
    const ar2Rig = buildHumanoidRig(
      { ...refSample, player: { ...refSample.player, name: 'AR2', squadNumber: 0 } },
      '#facc15', '#111827', '#000000', 'AR2', 'solid', normalTex, true
    );
    scene.add(refRig.group, refRig.shadowDisc, ar1Rig.group, ar2Rig.group);

    // Active Ball-Carrier Halo Ring
    const carrierRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      })
    );
    carrierRing.rotation.x = -Math.PI / 2;
    carrierRing.position.y = 0.04;
    carrierRing.visible = false;
    scene.add(carrierRing);

    // Starball 3D Football + Ground Shadow + Motion Trail
    const ballTex = makeSRGBTexture(createStarballTexture());
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 20, 16),
      new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = 0.03;
    scene.add(ballShadow);

    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(18 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const ballTrail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.55 })
    );
    scene.add(ballTrail);

    // Rain / Snow particles
    let weatherPoints: THREE.Points | null = null;
    if (weather !== 'clear_night') {
      const pCount = 1400;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 120;
        pPos[i * 3 + 1] = Math.random() * 28;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      weatherPoints = new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({
          color: weather === 'snow_flurry' ? '#ffffff' : '#bae6fd',
          size: weather === 'snow_flurry' ? 0.35 : 0.16,
          transparent: true,
          opacity: 0.68,
        })
      );
      scene.add(weatherPoints);
    }

    const handleResize = () => {
      if (!container || !renderer) return;
      const nw = container.clientWidth || 960;
      const nh = container.clientHeight || 540;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let rafId = 0;
    let lastUiSync = 0;
    let lastScoreSig = '0-0';
    let wearUpdatedAt60 = false;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      engine.step(dt, speedRef.current);

      const scoreSig = `${engine.stats[0].goals}-${engine.stats[1].goals}`;
      if (scoreSig !== lastScoreSig) {
        lastScoreSig = scoreSig;
        ledTex.image = createLedBoardTexture(
          engine.teams[0].club.code,
          engine.teams[1].club.code,
          engine.stats[0].goals,
          engine.stats[1].goals,
          stadium.name
        );
        ledTex.needsUpdate = true;
      }
      ledTex.offset.x = (elapsed * 0.08) % 1;

      const minute = engine.getMinute();
      if (!wearUpdatedAt60 && minute >= 60) {
        wearUpdatedAt60 = true;
        turfTex.image = createTurfTexture(stadium, 0.78, teamAssets[0].badgeImg);
        turfTex.needsUpdate = true;
      }

      const replayFrame = engine.getActiveReplayFrame();
      const replayPlayersMap = replayFrame
        ? new Map(replayFrame.players.map((rp) => [rp.id, rp]))
        : null;

      // Sync 22 articulated player rigs (keyed by teamIdx_slotIndex so live subs swap seamlessly)
      let activeCarrierWorld: { wx: number; wz: number; color: string } | null = null;
      for (const sp of engine.players) {
        const rig = playerRigs.get(`${sp.teamIdx}_${sp.slotIndex}`);
        if (!rig) continue;

        if (rig.currentPlayerId !== sp.id) {
          rig.currentPlayerId = sp.id;
          const club = engine.teams[sp.teamIdx].club;
          const assets = teamAssets[sp.teamIdx];
          rig.torsoMat.map = makeSRGBTexture(
            createJerseyTextureCanvas(
              club,
              sp.player.name,
              sp.player.squadNumber,
              minute >= 60 ? 0.5 : 0,
              sp.slotIndex === 0,
              assets.badgeImg,
              assets.jerseyImg
            )
          );
          rig.torsoMat.needsUpdate = true;
          rig.faceTex.image = createPlayerFaceTextureCanvas(sp.player);
          rig.faceTex.needsUpdate = true;
        }

        const isCardedSubject = engine.refereeCardAlert?.playerId === sp.id;
        if (sp.redCard && !isCardedSubject && !replayPlayersMap) {
          rig.group.visible = false;
          rig.shadowDisc.visible = false;
          continue;
        }
        rig.group.visible = true;
        rig.shadowDisc.visible = true;

        const rPlayer = replayPlayersMap?.get(sp.id);
        const px = rPlayer ? rPlayer.x : sp.x;
        const py = rPlayer ? rPlayer.y : sp.y;
        const pFacing = rPlayer ? rPlayer.facing : sp.facing;
        const pStride = rPlayer ? rPlayer.stridePhase : sp.stridePhase;
        const pDiveTimer = rPlayer ? rPlayer.diveTimer : sp.diveTimer;
        const pDiveDir = rPlayer ? rPlayer.diveDir : sp.diveDir;

        const { wx, wz } = toWorld(px, py);
        rig.group.position.set(wx, 0, wz);
        rig.group.rotation.y = -pFacing + Math.PI / 2;
        rig.shadowDisc.position.set(wx, 0.025, wz);

        if (!replayPlayersMap && engine.ball.ownerId === sp.id) {
          activeCarrierWorld = {
            wx,
            wz,
            color: engine.teams[sp.teamIdx].club.accent,
          };
        }

        const speed = replayPlayersMap ? 5.5 : Math.hypot(sp.vx, sp.vy);
        const swing = speed > 0.4 ? Math.sin(pStride) * 0.58 : 0;

        if (pDiveTimer > 0) {
          rig.group.rotation.z = pDiveDir * 1.15;
          rig.group.rotation.x = 0;
          rig.group.position.y = 0.55;
          rig.leftLeg.rotation.x = swing;
          rig.rightLeg.rotation.x = -swing;
          rig.leftKnee.rotation.x = 0.2;
          rig.rightKnee.rotation.x = 0.2;
          rig.leftArm.rotation.x = -2.2;
          rig.rightArm.rotation.x = -2.2;
          rig.leftArm.rotation.z = 0;
          rig.rightArm.rotation.z = 0;
        } else if (sp.celebrating) {
          rig.group.rotation.z = 0;
          if (sp.celebrationStyle === 'knee_slide') {
            rig.group.position.y = -0.32;
            rig.group.rotation.x = -0.24;
            rig.leftLeg.rotation.x = -0.3;
            rig.rightLeg.rotation.x = -0.3;
            rig.leftKnee.rotation.x = 1.65;
            rig.rightKnee.rotation.x = 1.65;
            rig.leftArm.rotation.x = -0.35;
            rig.rightArm.rotation.x = -0.35;
            rig.leftArm.rotation.z = -1.25;
            rig.rightArm.rotation.z = 1.25;
          } else if (sp.celebrationStyle === 'siuuu') {
            const leap = Math.abs(Math.sin(elapsed * 5.5));
            rig.group.position.y = leap * 0.68;
            rig.group.rotation.x = 0;
            rig.leftLeg.rotation.x = 0.15;
            rig.rightLeg.rotation.x = 0.15;
            rig.leftKnee.rotation.x = 0.1;
            rig.rightKnee.rotation.x = 0.1;
            rig.leftArm.rotation.x = 0.25;
            rig.rightArm.rotation.x = 0.25;
            rig.leftArm.rotation.z = -1.18;
            rig.rightArm.rotation.z = 1.18;
          } else if (sp.celebrationStyle === 'arms_wide') {
            rig.group.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.15;
            rig.group.rotation.x = 0.18;
            rig.leftLeg.rotation.x = swing;
            rig.rightLeg.rotation.x = -swing;
            rig.leftKnee.rotation.x = Math.max(0, -swing * 1.1);
            rig.rightKnee.rotation.x = Math.max(0, swing * 1.1);
            rig.leftArm.rotation.x = -0.2;
            rig.rightArm.rotation.x = -0.2;
            rig.leftArm.rotation.z = -1.42;
            rig.rightArm.rotation.z = 1.42;
          } else {
            // jump_fist
            rig.group.position.y = Math.abs(Math.sin(elapsed * 9)) * 0.46;
            rig.group.rotation.x = 0;
            rig.leftLeg.rotation.x = -0.2;
            rig.rightLeg.rotation.x = 0.2;
            rig.leftKnee.rotation.x = 0.35;
            rig.rightKnee.rotation.x = 0.35;
            rig.leftArm.rotation.x = -2.55;
            rig.rightArm.rotation.x = -2.55;
            rig.leftArm.rotation.z = -0.3;
            rig.rightArm.rotation.z = 0.3;
          }
        } else if (sp.reactionType !== 'none' && sp.reactionTimer > 0) {
          rig.group.rotation.z = 0;
          rig.group.position.y = 0;
          rig.leftLeg.rotation.x = swing * 0.5;
          rig.rightLeg.rotation.x = -swing * 0.5;
          rig.leftKnee.rotation.x = 0.1;
          rig.rightKnee.rotation.x = 0.1;
          if (sp.reactionType === 'hands_on_head') {
            rig.group.rotation.x = 0.22;
            rig.leftArm.rotation.x = -2.45;
            rig.rightArm.rotation.x = -2.45;
            rig.leftArm.rotation.z = 0.52;
            rig.rightArm.rotation.z = -0.52;
          } else if (sp.reactionType === 'appeal') {
            rig.group.rotation.x = 0;
            rig.leftArm.rotation.x = -1.4;
            rig.rightArm.rotation.x = -1.4;
            rig.leftArm.rotation.z = -0.85;
            rig.rightArm.rotation.z = 0.85;
          } else {
            // fist_pump
            rig.group.rotation.x = 0;
            rig.leftArm.rotation.x = -0.2;
            rig.rightArm.rotation.x = -2.5 + Math.sin(elapsed * 14) * 0.35;
            rig.leftArm.rotation.z = 0;
            rig.rightArm.rotation.z = -0.2;
          }
        } else if (
          engine.setPiece?.kind === 'throw_in' &&
          engine.setPiece.takerId === sp.id
        ) {
          rig.group.rotation.z = 0;
          rig.group.rotation.x = 0.08;
          rig.group.position.y = 0;
          rig.leftLeg.rotation.x = 0;
          rig.rightLeg.rotation.x = 0;
          rig.leftKnee.rotation.x = 0.1;
          rig.rightKnee.rotation.x = 0.1;
          rig.leftArm.rotation.x = -2.85;
          rig.rightArm.rotation.x = -2.85;
          rig.leftArm.rotation.z = 0.25;
          rig.rightArm.rotation.z = -0.25;
        } else {
          rig.group.rotation.z = 0;
          rig.group.position.y = 0;
          rig.group.rotation.x = speed > 5.8 ? 0.19 : speed > 2 ? 0.08 : 0;
          rig.leftLeg.rotation.x = swing;
          rig.rightLeg.rotation.x = sp.kickTimer > 0 ? -1.24 : -swing;
          rig.leftKnee.rotation.x = speed > 0.5 ? Math.max(0, -swing * 1.15) : 0.06;
          rig.rightKnee.rotation.x =
            sp.kickTimer > 0 ? 0.35 : speed > 0.5 ? Math.max(0, swing * 1.15) : 0.06;
          rig.leftArm.rotation.x = -swing * 0.85;
          rig.rightArm.rotation.x = sp.kickTimer > 0 ? 0.65 : swing * 0.85;
          rig.leftArm.rotation.z = 0;
          rig.rightArm.rotation.z = 0;
        }

        if (minute >= 60 && !rig.sweatApplied) {
          rig.sweatApplied = true;
          const club = engine.teams[sp.teamIdx].club;
          const assets = teamAssets[sp.teamIdx];
          rig.torsoMat.map = makeSRGBTexture(
            createJerseyTextureCanvas(
              club,
              sp.player.name,
              sp.player.squadNumber,
              0.75,
              sp.slotIndex === 0,
              assets.badgeImg,
              assets.jerseyImg
            )
          );
          rig.torsoMat.roughness = 0.35;
          rig.torsoMat.needsUpdate = true;
        }
      }

      if (engine.setPiece) {
        const spWorld = toWorld(engine.setPiece.x, engine.setPiece.y);
        setPieceRing.visible = true;
        setPieceRing.position.set(spWorld.wx, 0.05, spWorld.wz);
        const pulse = 1 + Math.sin(elapsed * 8) * 0.12;
        setPieceRing.scale.set(pulse, pulse, 1);
      } else {
        setPieceRing.visible = false;
      }

      if (activeCarrierWorld) {
        carrierRing.visible = true;
        carrierRing.position.set(activeCarrierWorld.wx, 0.04, activeCarrierWorld.wz);
        (carrierRing.material as THREE.MeshBasicMaterial).color.set(activeCarrierWorld.color);
      } else {
        carrierRing.visible = false;
      }

      if (engine.varCheck) {
        varLineMesh.visible = true;
        varLineMesh.position.x = toWorld(engine.varCheck.lineX, 50).wx;
        (varLineMesh.material as THREE.MeshBasicMaterial).color.set(
          engine.varCheck.outcome === 'disallowed' ? '#ef4444' : '#22d3ee'
        );
        varDefLineMesh.visible = true;
        varDefLineMesh.position.x = toWorld(engine.varCheck.defenderLineX, 50).wx;
        (varMonitorScreen.material as THREE.MeshBasicMaterial).color.set(
          Math.sin(elapsed * 12) > 0 ? '#22d3ee' : '#38bdf8'
        );
      } else {
        varLineMesh.visible = false;
        varDefLineMesh.visible = false;
        (varMonitorScreen.material as THREE.MeshBasicMaterial).color.set('#0284c7');
      }

      // Match Referee + Disciplinary Yellow/Red Card Confrontation & VAR Monitor Check
      const activeBallX = replayFrame ? replayFrame.ballX : engine.ball.x;
      const activeBallY = replayFrame ? replayFrame.ballY : engine.ball.y;
      const activeBallZ = replayFrame ? replayFrame.ballZ : engine.ball.z;
      const ballWorld = toWorld(activeBallX, activeBallY);

      const cardTarget = engine.refereeCardAlert
        ? engine.players.find((p) => p.id === engine.refereeCardAlert!.playerId)
        : null;

      if (engine.refereeCardAlert && cardTarget) {
        const cw = toWorld(cardTarget.x, cardTarget.y);
        refRig.group.position.set(cw.wx + (cw.wx > 0 ? -2.1 : 2.1), 0, cw.wz + 1.5);
        refRig.shadowDisc.position.set(refRig.group.position.x, 0.025, refRig.group.position.z);
        refRig.group.rotation.y = Math.atan2(
          cw.wx - refRig.group.position.x,
          cw.wz - refRig.group.position.z
        );
        refCardMesh.visible = true;
        (refCardMesh.material as THREE.MeshBasicMaterial).color.set(
          engine.refereeCardAlert.color === 'red' ? '#ef4444' : '#facc15'
        );
        refRig.rightArm.rotation.x = -2.85 + Math.sin(elapsed * 8) * 0.1;
        if (engine.refereeCardAlert.color === 'red') {
          refRig.leftArm.rotation.x = -1.5;
          refRig.leftArm.rotation.z = 0.72;
        } else {
          refRig.leftArm.rotation.x = -0.3;
          refRig.leftArm.rotation.z = 0;
        }
      } else if (engine.varCheck) {
        refRig.group.position.set(0, 0, -34.8);
        refRig.shadowDisc.position.set(0, 0.025, -34.8);
        refRig.group.rotation.y = Math.PI;
        refCardMesh.visible = false;
        const tvWave = Math.sin(elapsed * 6) * 0.28;
        refRig.leftArm.rotation.x = -2.0 + tvWave;
        refRig.rightArm.rotation.x = -2.0 - tvWave;
        refRig.leftArm.rotation.z = 0.45;
        refRig.rightArm.rotation.z = -0.45;
      } else {
        refRig.group.position.set(ballWorld.wx * 0.85, 0, ballWorld.wz * 0.85 - 6);
        refRig.shadowDisc.position.set(refRig.group.position.x, 0.025, refRig.group.position.z);
        refCardMesh.visible = false;
        refRig.rightArm.rotation.x = 0;
        refRig.leftArm.rotation.x = 0;
        refRig.leftArm.rotation.z = 0;
        refRig.rightArm.rotation.z = 0;
      }
      ar1Rig.group.position.set(Math.min(0, ballWorld.wx * 0.9), 0, -34.8);
      ar2Rig.group.position.set(Math.max(0, ballWorld.wx * 0.9), 0, 34.8);

      // 3D Starball + Ground Shadow + Trail (lift ball into taker's hands on throw-in)
      const throwInHoldY = engine.setPiece?.kind === 'throw_in' ? 1.85 : 0;
      ballMesh.position.set(ballWorld.wx, 0.25 + activeBallZ + throwInHoldY, ballWorld.wz);
      ballMesh.rotation.x += engine.ball.vx * dt * 0.65;
      ballMesh.rotation.z -= engine.ball.vy * dt * 0.65;
      ballShadow.position.set(ballWorld.wx, 0.03, ballWorld.wz);
      const shadowScale = Math.max(0.38, 1 - activeBallZ * 0.08);
      ballShadow.scale.set(shadowScale, shadowScale, 1);

      const trailAttr = ballTrail.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 18; i++) {
        const pt = engine.ball.trail[i] ?? engine.ball;
        const pw = toWorld(pt.x, pt.y);
        trailAttr.setXYZ(i, pw.wx, 0.25 + pt.z, pw.wz);
      }
      trailAttr.needsUpdate = true;

      // Waving Corner Flags & Roof Team Flags
      for (const wf of wavingFlags) {
        const pos = wf.mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < pos.count; k++) {
          const px = pos.getX(k);
          pos.setZ(k, wf.baseX[k] + Math.sin(elapsed * 5.2 + px * 2.5 + wf.phase) * 0.12);
        }
        pos.needsUpdate = true;
      }

      // Spring-Mass 24x12 Goal Net Vertex Geometries
      for (let g = 0; g < 2; g++) {
        const netData = engine.nets[g];
        const posAttr = netMeshes[g].geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          posAttr.setZ(i, netData.displacements[i] ?? 0);
        }
        posAttr.needsUpdate = true;
      }

      // GPU-Instanced 16,000 Fans (Torso + Head + Overhead Scarves) & Camera Flashes
      const excitement = engine.replayTimer > 0 ? 1.0 : engine.setPiece ? 0.65 : engine.xgDanger * 0.65;
      const jumpAmp = excitement > 0.15 ? 0.58 * excitement : 0.1;
      for (let i = 0; i < CROWD_COUNT; i += 2) {
        const sx = crowdBasePos[i * 3];
        const sy = crowdBasePos[i * 3 + 1];
        const sz = crowdBasePos[i * 3 + 2];
        const wave = Math.sin(elapsed * 3.2 + sx * 0.08 + sz * 0.08) * 0.5 + 0.5;
        const hop = Math.abs(Math.sin(elapsed * 6.5 + i * 0.13)) * jumpAmp * (0.35 + wave * 0.65);

        dummy.position.set(sx, sy + hop, sz);
        dummy.rotation.set(0, crowdRotY[i], 0);
        dummy.updateMatrix();
        crowdBodyMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(sx, sy + 0.42 + hop, sz);
        dummy.updateMatrix();
        crowdHeadMesh.setMatrixAt(i, dummy.matrix);

        if (i < SCARF_COUNT) {
          const scarfLift = hop * 1.35 + Math.sin(elapsed * 7.2 + i) * (0.06 + excitement * 0.16);
          dummy.position.set(scarfBasePos[i * 3], scarfBasePos[i * 3 + 1] + scarfLift, scarfBasePos[i * 3 + 2]);
          dummy.rotation.set(0, crowdRotY[i], Math.sin(elapsed * 6 + i) * 0.12);
          dummy.updateMatrix();
          crowdScarfMesh.setMatrixAt(i, dummy.matrix);
        }
      }
      crowdBodyMesh.instanceMatrix.needsUpdate = true;
      crowdHeadMesh.instanceMatrix.needsUpdate = true;
      crowdScarfMesh.instanceMatrix.needsUpdate = true;

      flashMat.opacity = excitement > 0.4 ? 0.25 + Math.abs(Math.sin(elapsed * 22)) * 0.65 : 0.08 + Math.abs(Math.sin(elapsed * 11)) * 0.12;

      // Trigger Goal Fireworks Confetti Burst when total goals increases
      const totalGoalsNow = engine.stats[0].goals + engine.stats[1].goals;
      if (totalGoalsNow > prevGoalCount) {
        prevGoalCount = totalGoalsNow;
        confettiActiveTimer = 3.2;
        const scoringTeam = engine.replayGoalTeam ?? 0;
        const gx = scoringTeam === 0 ? 53 : -53;
        confettiMat.color.set(engine.teams[scoringTeam].club.accent);
        confettiPoints.visible = true;
        const cAttr = confettiGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < CONFETTI_COUNT; i++) {
          cAttr.setXYZ(i, gx, 2.5, (Math.random() - 0.5) * 16);
          confettiVel[i * 3] = (Math.random() - 0.5) * 18;
          confettiVel[i * 3 + 1] = 8 + Math.random() * 14;
          confettiVel[i * 3 + 2] = (Math.random() - 0.5) * 18;
        }
        cAttr.needsUpdate = true;
      }
      if (confettiActiveTimer > 0) {
        confettiActiveTimer = Math.max(0, confettiActiveTimer - dt);
        const cAttr = confettiGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < CONFETTI_COUNT; i++) {
          confettiVel[i * 3 + 1] -= 9.8 * dt;
          cAttr.setXYZ(
            i,
            cAttr.getX(i) + confettiVel[i * 3] * dt,
            Math.max(0.1, cAttr.getY(i) + confettiVel[i * 3 + 1] * dt),
            cAttr.getZ(i) + confettiVel[i * 3 + 2] * dt
          );
        }
        cAttr.needsUpdate = true;
        if (confettiActiveTimer === 0) confettiPoints.visible = false;
      }

      if (weatherPoints) {
        const attr = weatherPoints.geometry.attributes.position as THREE.BufferAttribute;
        const fallSpeed = weather === 'snow_flurry' ? 4.5 : 18;
        for (let i = 0; i < attr.count; i++) {
          let py = attr.getY(i) - fallSpeed * dt;
          if (py < 0) py = 28;
          attr.setY(i, py);
        }
        attr.needsUpdate = true;
      }

      // Smooth Ball, Replay, VAR, & Referee Card Camera Tracking
      const rawBallTarget = new THREE.Vector3(ballWorld.wx, 0.25 + activeBallZ, ballWorld.wz);
      smoothedBall.lerp(rawBallTarget, 1 - Math.exp(-4.5 * dt));

      if (smoothedBall.x > 16) gkPovSide = 1;
      else if (smoothedBall.x < -16) gkPovSide = -1;

      const activeMode: CameraMode =
        engine.replayTimer > 0 || engine.varCheck !== null || engine.refereeCardAlert !== null
          ? 'replay'
          : cameraModeRef.current;

      if (activeMode !== prevCamMode) {
        prevCamMode = activeMode;
        transitionBlend = 0;
        transitionStartPos.copy(camPosCurrent);
        transitionStartLook.copy(camLookCurrent);
        transitionStartFov = camFovCurrent;
      }

      const finalThirdZoom = Math.abs(smoothedBall.x) > 25 ? 0.85 : 1.0;
      const camTargetPos = new THREE.Vector3(
        smoothedBall.x * 0.56,
        29 * finalThirdZoom,
        46 * finalThirdZoom
      );
      const lookTarget = new THREE.Vector3(
        smoothedBall.x * 0.76,
        1.0,
        smoothedBall.z * 0.64
      );
      let targetFov = 46;

      if (activeMode === 'tactical') {
        camTargetPos.set(smoothedBall.x * 0.28, 63, 20);
        lookTarget.set(smoothedBall.x * 0.35, 0, 0);
        targetFov = 52;
      } else if (activeMode === 'pitchside') {
        camTargetPos.set(smoothedBall.x * 0.84, 3.6, 35.5);
        lookTarget.set(smoothedBall.x, 1.35, smoothedBall.z);
        targetFov = 40;
      } else if (activeMode === 'gk_pov') {
        camTargetPos.set(gkPovSide * 55, 3.5, 0);
        lookTarget.set(smoothedBall.x * 0.65, 1.1, smoothedBall.z * 0.7);
        targetFov = 54;
      } else if (activeMode === 'replay') {
        if (engine.refereeCardAlert && cardTarget) {
          const cw = toWorld(cardTarget.x, cardTarget.y);
          camTargetPos.set(cw.wx + (cw.wx > 0 ? -4.5 : 4.5), 2.5, cw.wz + 5.8);
          lookTarget.set(cw.wx, 1.4, cw.wz);
          targetFov = 33;
        } else if (engine.varCheck) {
          const lineWx = toWorld(engine.varCheck.lineX, 50).wx;
          camTargetPos.set(lineWx + (lineWx > 0 ? -10 : 10), 14, 24);
          lookTarget.set(lineWx, 0.8, 0);
          targetFov = 38;
        } else if (engine.replayTimer > 0 && engine.replayTimer <= 2.3) {
          // Dramatic low behind-ball Instant Action Replay camera
          camTargetPos.set(
            ballWorld.wx + (ballWorld.wx > 0 ? 11 : -11),
            3.8,
            ballWorld.wz + 7.2
          );
          lookTarget.set(ballWorld.wx, 0.9, ballWorld.wz);
          targetFov = 36;
        } else {
          const scorer = engine.replayScorerId
            ? engine.players.find((p) => p.id === engine.replayScorerId)
            : null;
          const focusWorld = scorer
            ? toWorld(scorer.x, scorer.y)
            : { wx: smoothedBall.x, wz: smoothedBall.z };
          const angle = elapsed * 0.85;
          camTargetPos.set(
            focusWorld.wx + Math.cos(angle) * 9.5,
            4.2,
            focusWorld.wz + Math.sin(angle) * 9.5
          );
          lookTarget.set(focusWorld.wx, 1.35, focusWorld.wz);
          targetFov = 34;
        }
      }

      if (transitionBlend < 1) {
        transitionBlend = Math.min(1, transitionBlend + dt / 0.85);
        const t = transitionBlend;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camPosCurrent.lerpVectors(transitionStartPos, camTargetPos, ease);
        camLookCurrent.lerpVectors(transitionStartLook, lookTarget, ease);
        camFovCurrent = THREE.MathUtils.lerp(transitionStartFov, targetFov, ease);
      } else {
        const followAlpha = 1 - Math.exp(-5.0 * dt);
        camPosCurrent.lerp(camTargetPos, followAlpha);
        camLookCurrent.lerp(lookTarget, followAlpha);
        camFovCurrent = THREE.MathUtils.lerp(camFovCurrent, targetFov, followAlpha);
      }

      camera.position.copy(camPosCurrent);
      camera.lookAt(camLookCurrent);
      if (Math.abs(camera.fov - camFovCurrent) > 0.04) {
        camera.fov = camFovCurrent;
        camera.updateProjectionMatrix();
      }

      renderer!.render(scene, camera);

      if (elapsed - lastUiSync > 0.14) {
        lastUiSync = elapsed;
        onTickRef.current?.();
      }
    };
    animate();

    return () => {
      sceneDisposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      turfTex.dispose();
      grassBumpTex.dispose();
      normalTex.dispose();
      ledTex.dispose();
      ballTex.dispose();
      homeBannerTex.dispose();
      awayBannerTex.dispose();
      for (const rig of playerRigs.values()) {
        rig.faceTex.dispose();
      }
      renderer?.dispose();
    };
  }, [engine, stadium, weather]);

  useEffect(() => {
    if (!fallback2D) return;
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    canvas.className = 'w-full h-full object-contain';
    container.innerHTML = '';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;

    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      engine.step(dt, speedRef.current);

      ctx.drawImage(createTurfTexture(stadium, 0.2), 0, 0, 960, 540);
      for (const sp of engine.players) {
        if (sp.redCard) continue;
        const px = (sp.x / 100) * 960;
        const py = (sp.y / 100) * 540;
        ctx.fillStyle = engine.teams[sp.teamIdx].club.primary;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc((engine.ball.x / 100) * 960, (engine.ball.y / 100) * 540 - engine.ball.z * 3, 6, 0, Math.PI * 2);
      ctx.fill();
      onTickRef.current?.();
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [fallback2D, engine, stadium]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[380px] md:h-[520px] rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950 shadow-2xl"
    />
  );
};
