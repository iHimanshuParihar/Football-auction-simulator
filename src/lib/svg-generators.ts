import { ClubPreset, Player } from '@/types/game';

/**
 * Generates a crisp 1024x1024 UV-mapped jersey texture canvas for Three.js
 * character torsos, complete with club pattern, crest, sponsor, back name,
 * squad number, sleeve trim, and progressive sweat/mud accumulation.
 */
export function createJerseyTextureCanvas(
  club: ClubPreset,
  playerName: string,
  squadNumber: number,
  sweatFactor = 0,
  isGoalkeeper = false,
  badgeImg?: HTMLImageElement | null,
  jerseyImg?: HTMLImageElement | null
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const primary = isGoalkeeper ? '#10b981' : club.primary;
  const secondary = isGoalkeeper ? '#064e3b' : club.secondary;
  const accent = isGoalkeeper ? '#fef08a' : club.accent;

  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 1024, 1024);

  if (!isGoalkeeper) {
    if (club.pattern === 'stripes') {
      ctx.fillStyle = secondary;
      for (let x = 0; x < 1024; x += 128) {
        ctx.fillRect(x, 0, 64, 1024);
      }
    } else if (club.pattern === 'hoops') {
      ctx.fillStyle = secondary;
      for (let y = 0; y < 1024; y += 140) {
        ctx.fillRect(0, y, 1024, 70);
      }
    } else if (club.pattern === 'sash') {
      ctx.save();
      ctx.fillStyle = secondary;
      ctx.translate(256, 512);
      ctx.rotate(-0.48);
      ctx.fillRect(-70, -650, 140, 1300);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = secondary;
      ctx.translate(768, 512);
      ctx.rotate(0.48);
      ctx.fillRect(-70, -650, 140, 1300);
      ctx.restore();
    } else if (club.pattern === 'center') {
      ctx.fillStyle = secondary;
      ctx.fillRect(186, 0, 140, 1024);
      ctx.fillRect(698, 0, 140, 1024);
    } else if (club.pattern === 'sleeves') {
      ctx.fillStyle = secondary;
      ctx.fillRect(0, 0, 1024, 180);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 172, 1024, 16);
    }
  }

  // If official club kit PNG loaded, blend the shirt center cleanly onto front chest panel
  if (!isGoalkeeper && jerseyImg) {
    try {
      ctx.drawImage(jerseyImg, 76, 70, 360, 740);
    } catch {
      // keep pattern fallback
    }
  }

  // Collar trim
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 1024, 48);

  // Front half = left 512px, Back half = right 512px
  // Front Club Crest badge (official PNG badge when available, fallback circle badge)
  ctx.save();
  ctx.translate(332, 230);
  if (badgeImg) {
    try {
      ctx.drawImage(badgeImg, -46, -46, 92, 92);
    } catch {
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fillStyle = secondary;
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(club.code, 0, 2);
  }
  ctx.restore();

  // Front Sponsor Typography (only when no real club jersey photo overlaid)
  if (isGoalkeeper || !jerseyImg) {
    ctx.fillStyle = club.pattern === 'solid' || club.pattern === 'sleeves' ? secondary : '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 8;
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('STARBALL', 256, 440);
    ctx.fillText('STARBALL', 256, 440);
    ctx.font = '700 22px sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText('UCL CHAMPIONS', 256, 476);
  }

  // Back of Shirt: Player Name + Big Squad Number (1-11)
  const lastName = playerName.split(' ').slice(-1)[0].toUpperCase().slice(0, 12);
  ctx.textAlign = 'center';
  ctx.font = '900 44px sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(lastName, 768, 250);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(lastName, 768, 250);

  ctx.font = '900 230px sans-serif';
  ctx.lineWidth = 16;
  ctx.strokeText(String(squadNumber), 768, 520);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(squadNumber), 768, 520);

  // Progressive sweat & turf mud darkening after 60' mark
  if (sweatFactor > 0.02) {
    const grad = ctx.createLinearGradient(0, 300, 0, 1024);
    grad.addColorStop(0, `rgba(15, 23, 42, ${sweatFactor * 0.22})`);
    grad.addColorStop(0.75, `rgba(45, 30, 15, ${sweatFactor * 0.35})`);
    grad.addColorStop(1, `rgba(22, 60, 28, ${sweatFactor * 0.42})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  return canvas;
}

/**
 * Generates a woven fabric micro-texture bump canvas for PBR kit realism.
 */
export function createFabricNormalCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? '#969696' : '#6c6c6c';
    ctx.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, 0, 2, 256);
  }
  return canvas;
}

/**
 * Generates a 256x256 UV-aligned facial texture canvas for 3D player heads.
 * When applied to Three.js SphereGeometry with rotation.y = -Math.PI / 2,
 * the face centered at x = 128 maps directly forward (+Z).
 */
export function createPlayerFaceTextureCanvas(player: Player): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const { skinTone, hairColor, beardStyle } = player.appearance;

  ctx.fillStyle = skinTone;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle cheekbone & jaw shading
  const shade = ctx.createRadialGradient(128, 128, 25, 128, 128, 110);
  shade.addColorStop(0, 'rgba(255,255,255,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 256);

  // Eyebrows
  ctx.strokeStyle = hairColor;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(96, 108);
  ctx.quadraticCurveTo(106, 102, 116, 108);
  ctx.moveTo(140, 108);
  ctx.quadraticCurveTo(150, 102, 160, 108);
  ctx.stroke();

  // Eyes (sclera + iris + pupil + highlight)
  for (const ex of [106, 150]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, 120, 8.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(ex, 120, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 1.4, 118.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(128, 118);
  ctx.lineTo(125, 138);
  ctx.lineTo(132, 140);
  ctx.stroke();

  // Beard / Stubble
  if (beardStyle === 'full') {
    ctx.fillStyle = hairColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(92, 140);
    ctx.quadraticCurveTo(128, 195, 164, 140);
    ctx.quadraticCurveTo(145, 162, 128, 162);
    ctx.quadraticCurveTo(111, 162, 92, 140);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (beardStyle === 'stubble') {
    ctx.fillStyle = hairColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(128, 160, 32, 20, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (beardStyle === 'goatee') {
    ctx.fillStyle = hairColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(128, 164, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Mouth
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(116, 154);
  ctx.quadraticCurveTo(128, 161, 140, 154);
  ctx.stroke();

  return c;
}

/**
 * Generates a deterministic procedural SVG portrait for 0ms offline rendering.
 */
export function buildPlayerPortraitSvg(player: Player, kitColor = '#1d4ed8'): string {
  const { skinTone, hairStyle, hairColor, beardStyle } = player.appearance;
  let hairPath = '';
  if (hairStyle === 'short_fade') {
    hairPath = `<path d="M28 42 C28 20, 72 20, 72 42 C68 31, 32 31, 28 42 Z" fill="${hairColor}"/>`;
  } else if (hairStyle === 'curly_afro') {
    hairPath = `<circle cx="34" cy="30" r="11" fill="${hairColor}"/><circle cx="50" cy="24" r="13" fill="${hairColor}"/><circle cx="66" cy="30" r="11" fill="${hairColor}"/><circle cx="29" cy="40" r="8" fill="${hairColor}"/><circle cx="71" cy="40" r="8" fill="${hairColor}"/>`;
  } else if (hairStyle === 'long_tied') {
    hairPath = `<path d="M25 46 C24 18, 76 18, 75 46 L78 72 L67 70 L66 36 C56 29, 44 29, 34 36 L33 70 L22 72 Z" fill="${hairColor}"/>`;
  } else if (hairStyle === 'slicked') {
    hairPath = `<path d="M28 43 C27 19, 73 17, 72 43 C64 28, 36 28, 28 43 Z" fill="${hairColor}"/>`;
  } else {
    hairPath = `<path d="M30 40 C30 23, 70 23, 70 40 C65 34, 35 34, 30 40 Z" fill="${hairColor}" opacity="0.72"/>`;
  }

  let beardPath = '';
  if (beardStyle === 'full') {
    beardPath = `<path d="M32 54 C33 73, 67 73, 68 54 C64 62, 56 64, 50 64 C44 64, 36 62, 32 54 Z" fill="${hairColor}" opacity="0.88"/>`;
  } else if (beardStyle === 'stubble') {
    beardPath = `<path d="M33 56 C35 71, 65 71, 67 56" fill="none" stroke="${hairColor}" stroke-width="4" opacity="0.32" stroke-linecap="round"/>`;
  } else if (beardStyle === 'goatee') {
    beardPath = `<path d="M43 60 C44 69, 56 69, 57 60 Z" fill="${hairColor}" opacity="0.85"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg_${player.id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="16" fill="url(#bg_${player.id})"/>
    <path d="M16 100 C18 76, 82 76, 84 100 Z" fill="${kitColor}"/>
    <path d="M41 78 L50 86 L59 78" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.85"/>
    <rect x="43" y="65" width="14" height="16" rx="6" fill="${skinTone}"/>
    <ellipse cx="50" cy="48" rx="19" ry="23" fill="${skinTone}"/>
    ${beardPath}
    <circle cx="42" cy="47" r="2.2" fill="#0f172a"/>
    <circle cx="58" cy="47" r="2.2" fill="#0f172a"/>
    <path d="M38 42 Q42 40 46 42" stroke="#1e293b" stroke-width="1.6" fill="none"/>
    <path d="M54 42 Q58 40 62 42" stroke="#1e293b" stroke-width="1.6" fill="none"/>
    <path d="M45 58 Q50 61 55 58" stroke="#7c2d12" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${hairPath}
  </svg>`;
}
