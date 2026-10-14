import React from 'react';

export function KisanQLogo({ size = 36, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 55%, #ca8a04 100%)',
          boxShadow: '0 4px 14px rgba(22, 163, 74, 0.28)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle glass reflection highlight */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)',
            borderTopLeftRadius: Math.round(size * 0.32),
            borderTopRightRadius: Math.round(size * 0.32)
          }}
        />
        {/* Modern Vector Icon: Leaf + Golden Grain Ear forming "Q" */}
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Leaf Body */}
          <path
            d="M4 20C4 20 5.5 12 12 7C18.5 2 20 4 20 4C20 4 19 12 13 17C7 22 4 20 4 20Z"
            fill="#ffffff"
            fillOpacity="0.95"
          />
          {/* Leaf Central Vein (Forms the tail of Q) */}
          <path
            d="M7 17L18 6"
            stroke="#15803d"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Golden Sprout Seed (The Q tail accent) */}
          <circle cx="17.5" cy="18.5" r="2.5" fill="#fef08a" />
          <path
            d="M17.5 16C19 17.5 20 19 20 20"
            stroke="#fef08a"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span
              style={{
                fontSize: Math.round(size * 0.58),
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                color: 'var(--text)'
              }}
            >
              Kisan
            </span>
            <span
              style={{
                fontSize: Math.round(size * 0.62),
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                color: 'var(--accent)'
              }}
            >
              Q
            </span>
          </div>
          <span
            className="muted"
            style={{
              fontSize: 9,
              letterSpacing: '0.12em',
              fontWeight: 750,
              textTransform: 'uppercase',
              marginTop: 1
            }}
          >
            Digital Mandi APMC
          </span>
        </div>
      )}
    </div>
  );
}
