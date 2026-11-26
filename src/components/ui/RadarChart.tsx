'use client';

import React from 'react';
import { PlayerStats } from '@/types/game';

interface RadarChartProps {
  stats: PlayerStats;
  accentColor?: string;
  size?: number;
}

const AXES: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'pac', label: 'PAC' },
  { key: 'sho', label: 'SHO' },
  { key: 'pas', label: 'PAS' },
  { key: 'dri', label: 'DRI' },
  { key: 'def', label: 'DEF' },
  { key: 'phy', label: 'PHY' },
];

export const RadarChart: React.FC<RadarChartProps> = ({
  stats,
  accentColor = '#38bdf8',
  size = 210,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;

  const pointAt = (idx: number, ratio: number) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / AXES.length;
    return {
      x: cx + Math.cos(angle) * r * ratio,
      y: cy + Math.sin(angle) * r * ratio,
    };
  };

  const rings = [0.25, 0.5, 0.75, 1.0];
  const statPoints = AXES.map((a, i) => pointAt(i, stats[a.key] / 100));
  const polygonStr = statPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {rings.map((ring) => {
        const pts = AXES.map((_, i) => pointAt(i, ring))
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ');
        return (
          <polygon
            key={ring}
            points={pts}
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1"
          />
        );
      })}

      {AXES.map((axis, i) => {
        const end = pointAt(i, 1);
        const labelPos = pointAt(i, 1.24);
        return (
          <g key={axis.key}>
            <line
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1"
            />
            <text
              x={labelPos.x}
              y={labelPos.y + 3}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="10"
              fontWeight="700"
            >
              {axis.label} {stats[axis.key]}
            </text>
          </g>
        );
      })}

      <polygon
        points={polygonStr}
        fill={accentColor}
        fillOpacity="0.28"
        stroke={accentColor}
        strokeWidth="2.2"
      />

      {statPoints.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3.2" fill="#ffffff" stroke={accentColor} strokeWidth="1.5" />
      ))}
    </svg>
  );
};
