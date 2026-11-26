'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ClubPreset, Player } from '@/types/game';
import { loadSameOriginClubImage } from '@/lib/club-assets-client';
import {
  buildPlayerPortraitSvg,
  createFabricNormalCanvas,
  createJerseyTextureCanvas,
  createPlayerFaceTextureCanvas,
} from '@/lib/svg-generators';

interface TurntablePlayer3DProps {
  player: Player;
  club?: ClubPreset;
}

function createClubBadgeTexture(
  club: ClubPreset,
  badgeImg?: HTMLImageElement | null
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Outer glow ring
  const grad = ctx.createRadialGradient(256, 256, 80, 256, 256, 240);
  grad.addColorStop(0, club.primary);
  grad.addColorStop(0.7, club.secondary);
  grad.addColorStop(1, 'rgba(2,6,23,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
  ctx.fill();

  if (badgeImg) {
    try {
      ctx.beginPath();
      ctx.arc(256, 256, 178, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(2,6,23,0.72)';
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = club.accent;
      ctx.stroke();
      ctx.drawImage(badgeImg, 96, 96, 320, 320);
      return c;
    } catch {
      // fallback below
    }
  }

  // Shield / Circle crest
  ctx.beginPath();
  ctx.arc(256, 256, 178, 0, Math.PI * 2);
  ctx.fillStyle = club.primary;
  ctx.fill();
  ctx.lineWidth = 18;
  ctx.strokeStyle = club.accent;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 256, 138, 0, Math.PI * 2);
  ctx.fillStyle = club.secondary;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(club.code, 256, 248);

  ctx.fillStyle = club.accent;
  ctx.font = '800 28px sans-serif';
  ctx.fillText(club.name.toUpperCase().slice(0, 16), 256, 330);
  return c;
}

export const TurntablePlayer3D: React.FC<TurntablePlayer3DProps> = ({
  player,
  club,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const activeClub: ClubPreset = useMemo(
    () =>
      club ?? {
        id: 'ucl_default',
        name: player.club,
        code: player.club.slice(0, 3).toUpperCase(),
        primary: '#1d4ed8',
        secondary: '#0f172a',
        accent: '#38bdf8',
        pattern: 'sash',
        stadium: 'etihad',
        city: 'Europe',
        crestShape: 'circle',
        crestMotif: 'star',
      },
    [club, player.club]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() => setWebglFailed(true));
      return;
    }

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 40);
    camera.position.set(0, 1.48, 3.85);
    camera.lookAt(0, 1.02, 0);

    // 3-Point Broadcast Studio Lighting
    scene.add(new THREE.AmbientLight('#bfdbfe', 0.8));
    const keyLight = new THREE.SpotLight('#ffffff', 52, 18, Math.PI / 4, 0.45);
    keyLight.position.set(2.6, 4.6, 3.4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(activeClub.accent, 2.2);
    rimLight.position.set(-3, 2.5, -2.5);
    scene.add(rimLight);

    // Glowing UCL Studio Pedestal
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.1, 0.2, 42),
      new THREE.MeshStandardMaterial({
        color: '#0b132b',
        metalness: 0.8,
        roughness: 0.22,
      })
    );
    podium.position.y = -0.1;
    podium.receiveShadow = true;
    scene.add(podium);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.025, 14, 56),
      new THREE.MeshBasicMaterial({ color: activeClub.accent })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Floating 3D Holographic Club Crest Plaque behind player
    const badgeTex = new THREE.CanvasTexture(createClubBadgeTexture(activeClub));
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    const badgeMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.68, 36),
      new THREE.MeshBasicMaterial({
        map: badgeTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    badgeMesh.position.set(0, 1.38, -0.95);
    scene.add(badgeMesh);

    // Articulated 3D Character Rig
    const root = new THREE.Group();
    const heightScale = player.appearance.heightM / 1.8;
    const musc = player.appearance.muscularity;
    root.scale.set(musc, heightScale, musc);
    scene.add(root);

    const kitCanvas = createJerseyTextureCanvas(
      activeClub,
      player.name,
      player.pos === 'GK' ? 1 : 10,
      0,
      player.pos === 'GK'
    );
    const kitTex = new THREE.CanvasTexture(kitCanvas);
    kitTex.colorSpace = THREE.SRGBColorSpace;
    const normalTex = new THREE.CanvasTexture(createFabricNormalCanvas());
    const faceTex = new THREE.CanvasTexture(createPlayerFaceTextureCanvas(player));
    faceTex.colorSpace = THREE.SRGBColorSpace;

    let disposed = false;
    Promise.all([
      loadSameOriginClubImage(activeClub.name, 'badge'),
      loadSameOriginClubImage(activeClub.name, 'jersey'),
    ]).then(([badgeImg, jerseyImg]) => {
      if (disposed) return;
      if (badgeImg) {
        badgeTex.image = createClubBadgeTexture(activeClub, badgeImg);
        badgeTex.needsUpdate = true;
      }
      if (badgeImg || jerseyImg) {
        kitTex.image = createJerseyTextureCanvas(
          activeClub,
          player.name,
          player.pos === 'GK' ? 1 : 10,
          0,
          player.pos === 'GK',
          badgeImg,
          jerseyImg
        );
        kitTex.needsUpdate = true;
      }
    });

    const jerseyMat = new THREE.MeshStandardMaterial({
      map: kitTex,
      bumpMap: normalTex,
      bumpScale: 0.014,
      roughness: 0.58,
    });
    const shortsMat = new THREE.MeshStandardMaterial({
      color: activeClub.secondary,
      roughness: 0.68,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: player.appearance.skinTone,
      roughness: 0.52,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.52,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: player.appearance.hairColor,
      roughness: 0.82,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: activeClub.accent,
      roughness: 0.3,
      metalness: 0.3,
    });

    // Pelvis + Torso (rotated -PI/2 so Front Crest/Sponsor faces +Z and Back Name/Number faces -Z)
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), shortsMat);
    pelvis.position.y = 0.88;
    pelvis.castShadow = true;
    root.add(pelvis);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.17, 0.54, 20), jerseyMat);
    torso.position.y = 1.23;
    torso.rotation.y = -Math.PI / 2;
    torso.castShadow = true;
    root.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), skinMat);
    neck.position.y = 1.52;
    root.add(neck);

    // Head with UV-mapped detailed face + Hair
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.142, 22, 18), faceMat);
    head.position.y = 1.66;
    head.rotation.y = -Math.PI / 2;
    head.castShadow = true;
    root.add(head);

    const hs = player.appearance.hairStyle;
    if (hs === 'curly_afro') {
      const afro = new THREE.Mesh(new THREE.SphereGeometry(0.162, 14, 14), hairMat);
      afro.position.set(0, 1.7, -0.01);
      root.add(afro);
    } else if (hs === 'long_tied') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.144, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
      cap.position.y = 1.67;
      root.add(cap);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.22, 8), hairMat);
      tail.position.set(0, 1.58, -0.15);
      tail.rotation.x = -0.35;
      root.add(tail);
    } else {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.143, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
      cap.position.y = 1.67;
      root.add(cap);
    }

    // Arms + Sleeves
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.48, 10), skinMat);
      arm.position.set(side * 0.26, 1.19, 0);
      arm.rotation.z = side * 0.14;
      arm.castShadow = true;
      root.add(arm);

      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.056, 0.18, 10), jerseyMat);
      sleeve.position.set(side * 0.24, 1.36, 0);
      sleeve.rotation.z = side * 0.14;
      root.add(sleeve);
    }

    // Legs, Socks & Boots
    const sockMat = new THREE.MeshStandardMaterial({ color: activeClub.primary, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.062, 0.42, 10), shortsMat);
      thigh.position.set(side * 0.11, 0.65, 0);
      thigh.castShadow = true;
      root.add(thigh);

      const knee = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.05, 0.14, 10), skinMat);
      knee.position.set(side * 0.11, 0.4, 0);
      root.add(knee);

      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.28, 10), sockMat);
      sock.position.set(side * 0.11, 0.2, 0);
      sock.castShadow = true;
      root.add(sock);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.075, 0.22), bootMat);
      boot.position.set(side * 0.11, 0.04, 0.04);
      boot.castShadow = true;
      root.add(boot);
    }

    // Starball at foot
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.115, 1),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 })
    );
    ball.position.set(0.34, 0.115, 0.24);
    ball.castShadow = true;
    scene.add(ball);

    let rafId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      root.rotation.y = t * 0.62;
      root.position.y = Math.sin(t * 2.1) * 0.012;
      badgeMesh.position.y = 1.38 + Math.sin(t * 1.7) * 0.03;
      ball.rotation.y = t * 1.6;
      ball.position.y = 0.115 + Math.abs(Math.sin(t * 2.4)) * 0.035;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      kitTex.dispose();
      normalTex.dispose();
      faceTex.dispose();
      badgeTex.dispose();
      renderer.dispose();
    };
  }, [player, activeClub]);

  if (webglFailed) {
    const svg = buildPlayerPortraitSvg(player, activeClub.primary);
    return (
      <div className="w-full h-[270px] flex items-center justify-center rounded-xl bg-slate-950/60 border border-cyan-500/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
          alt={player.name}
          className="w-44 h-44 rounded-2xl shadow-2xl"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[270px] rounded-xl overflow-hidden bg-gradient-to-b from-slate-900/75 via-[#071230] to-slate-950/95 border border-cyan-500/25"
    />
  );
};
