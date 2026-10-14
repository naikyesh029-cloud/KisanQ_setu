'use client';

import { useState } from 'react';
import {
  Truck,
  Warehouse,
  CheckCircle2,
  Sparkles,
  Sliders,
  Scale,
  Clock
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface HourlyLoad {
  hour: string;
  expectedQuintals: number;
  capacityLimit: number;
  congestionPct: number;
}

const hourlyYardCurve: HourlyLoad[] = [
  { hour: '06:00', expectedQuintals: 180, capacityLimit: 400, congestionPct: 45 },
  { hour: '08:00', expectedQuintals: 420, capacityLimit: 450, congestionPct: 93 },
  { hour: '10:00', expectedQuintals: 380, capacityLimit: 450, congestionPct: 84 },
  { hour: '12:00', expectedQuintals: 220, capacityLimit: 350, congestionPct: 62 },
  { hour: '14:00', expectedQuintals: 150, capacityLimit: 300, congestionPct: 50 },
  { hour: '16:00', expectedQuintals: 90, capacityLimit: 250, congestionPct: 36 }
];

const commodityBreakdown = [
  { name: 'Soybean', quintals: 580, share: 41, color: '#f59e0b' },
  { name: 'Onion', quintals: 390, share: 28, color: '#ec4899' },
  { name: 'Wheat', quintals: 260, share: 18, color: '#10b981' },
  { name: 'Tomato', quintals: 180, share: 13, color: '#ef4444' }
];

const gateSlots = [
  {
    gate: 'Gate 1 (Heavy Scale)',
    lane: 'Lane A',
    assignedCrops: 'Wheat, Maize & Grains',
    bookedVehicles: 24,
    gateCapacity: 28,
    utilization: 86,
    status: 'high_load',
    recommendation: 'Divert 4 multi-axle trucks to Gate 2 auxiliary weighbridge'
  },
  {
    gate: 'Gate 2 (Medium Intake)',
    lane: 'Lane B',
    assignedCrops: 'Soybean, Pulses & Oilseeds',
    bookedVehicles: 18,
    gateCapacity: 30,
    utilization: 60,
    status: 'optimal',
    recommendation: 'Intake flow optimal. Ready to accept diverted loads.'
  },
  {
    gate: 'Gate 3 (Rapid Green Lane)',
    lane: 'Lane C',
    assignedCrops: 'Perishables: Tomato & Vegetables',
    bookedVehicles: 11,
    gateCapacity: 20,
    utilization: 55,
    status: 'optimal',
    recommendation: 'Priority lane active. Rapid weighbridge transit maintained.'
  }
];

export function AiSlotForecaster() {
  const [balanced, setBalanced] = useState(false);

  // Overall Congestion Index
  const congestionScore = balanced ? 62 : 78;
  const expectedProduceTotal = 1410; // Quintals

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Top Intelligence Banner */}
      <div
        className="surface"
        style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(59,130,246,0.06) 100%)',
          borderColor: 'rgba(34,197,94,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--accent)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 800 }}>
              AI YARD FORECASTING ENGINE
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0' }}>
              Predictive Slot Distribution & Congestion Management
            </h3>
            <p className="muted" style={{ fontSize: 12, margin: '3px 0 0' }}>
              Machine-assisted queue balancing, gate throughput optimization, and storage headroom feasibility.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn"
            style={{
              fontSize: 12,
              background: balanced ? 'var(--accent)' : 'var(--surface)',
              color: balanced ? '#fff' : 'var(--text)'
            }}
            onClick={() => setBalanced(!balanced)}
          >
            <Sliders size={14} /> {balanced ? '✓ AI Balanced Mode Active' : 'Auto-Balance Gate Slots'}
          </button>
        </div>
      </div>

      {/* 4 Core Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Congestion Index */}
        <div className="surface" style={{ padding: 18 }}>
          <div className="flex justify-between items-center">
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Yard Congestion Index</span>
            <Truck size={17} color={congestionScore >= 75 ? 'var(--warning)' : 'var(--accent)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: congestionScore >= 75 ? '#d97706' : 'var(--accent)' }}>
              {congestionScore}%
            </span>
            <span className={`badge ${congestionScore >= 75 ? 'badge-warn' : 'badge-accent'}`}>
              {congestionScore >= 75 ? 'Moderate to High' : 'Optimized Flow'}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', marginTop: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${congestionScore}%`,
                height: '100%',
                background: congestionScore >= 75 ? '#d97706' : 'var(--accent)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Peak arrival risk: <strong>08:00 – 10:00</strong>
          </p>
        </div>

        {/* 2. Expected Produce */}
        <div className="surface" style={{ padding: 18 }}>
          <div className="flex justify-between items-center">
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Expected Produce (Volume)</span>
            <Scale size={17} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 10 }}>
            {expectedProduceTotal.toLocaleString('en-IN')}{' '}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>qtl</span>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            ~141 Metric Tonnes across 53 booked arrival tokens
          </p>
        </div>

        {/* 3. Storage Headroom Feasibility */}
        <div className="surface" style={{ padding: 18 }}>
          <div className="flex justify-between items-center">
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Storage Feasibility</span>
            <Warehouse size={17} color="var(--accent)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--accent)' }}>
              73%
            </span>
            <span className="badge badge-accent">Feasible</span>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            1,240 quintals available across cold & dry sheds
          </p>
        </div>

        {/* 4. Active Gate Lanes */}
        <div className="surface" style={{ padding: 18 }}>
          <div className="flex justify-between items-center">
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Mandi Gate Slots</span>
            <Clock size={17} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 10 }}>
            3 Active <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Gates</span>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            53 vehicles scheduled · 2 weighbridges online
          </p>
        </div>
      </div>

      {/* Hourly Yard Load Curve & Commodity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Hourly Yard Load Chart */}
        <section className="surface lg:col-span-2" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                Hourly Yard Load & Peak Congestion Curve
              </h3>
              <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                Expected produce arrival throughput (quintals) across gate operating hours
              </p>
            </div>
            <span className="badge badge-neutral">AI Model: v1.4</span>
          </div>

          <div style={{ height: 260, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyYardCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="yardLoadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 12
                  }}
                  formatter={(val: unknown) => [`${String(val ?? 0)} quintals`, 'Expected Intake']}
                />
                <Area
                  type="monotone"
                  dataKey="expectedQuintals"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#yardLoadGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Predicted Commodity Breakdown */}
        <section className="surface" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>
            Commodity Volume Breakdown
          </h3>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 16px' }}>
            Predicted arrival share for today
          </p>

          <div style={{ display: 'grid', gap: 12 }}>
            {commodityBreakdown.map(c => (
              <div key={c.name} style={{ padding: 10, borderRadius: 8, background: 'var(--bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <strong>{c.name}</strong>
                  <span style={{ fontWeight: 800, color: c.color }}>{c.quintals} qtl ({c.share}%)</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${c.share}%`, height: '100%', background: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Mandi Gate Slot Allocation & Dynamic Balancing */}
      <section className="surface" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              Mandi Gate Slots & Weighbridge Allocation
            </h3>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Lane assignment, capacity bounds, and automated diversion recommendations
            </p>
          </div>

          <span className="badge badge-accent">
            <CheckCircle2 size={13} /> Weighbridge Scales Calibrated
          </span>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {gateSlots.map(s => {
            const isHigh = s.utilization >= 80 && !balanced;
            return (
              <div
                key={s.gate}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: `1px solid ${isHigh ? '#d97706' : 'var(--border)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{s.gate}</strong>
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>{s.lane}</span>
                    <span className={`badge ${isHigh ? 'badge-warn' : 'badge-accent'}`}>
                      {isHigh ? 'Heavy Traffic' : 'Fluid Flow'}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Commodity Stream: <strong>{s.assignedCrops}</strong>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, color: isHigh ? '#d97706' : 'var(--accent)' }}>
                    💡 <strong>AI Guidance:</strong> {balanced ? 'Lane load re-balanced evenly. Zero queue spillover.' : s.recommendation}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {balanced && isHigh ? 20 : s.bookedVehicles} / {s.gateCapacity}{' '}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>Vehicles</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    Utilization: {balanced && isHigh ? 71 : s.utilization}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Multi-Tier Storage Headroom Feasibility */}
      <section className="surface" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>
          Multi-Tier Storage Headroom Feasibility
        </h3>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 16px' }}>
          Real-time physical capacity analysis to prevent post-intake spoilage and yard overflow
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Cold Storage Shed A</strong>
              <span className="badge badge-accent">70% Full</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Perishables: Tomato, Greens</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>
              560 / 800 <span style={{ fontSize: 11, fontWeight: 500 }}>qtl</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Available Headroom: <strong>240 qtl</strong> (Safe for afternoon intake)
            </div>
          </div>

          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Covered Grain Warehouse B</strong>
              <span className="badge badge-accent">70% Full</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Moisture-Sensitive: Wheat, Soybean</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>
              2,450 / 3,500 <span style={{ fontSize: 11, fontWeight: 500 }}>qtl</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Available Headroom: <strong>1,050 qtl</strong> (Feasible)
            </div>
          </div>

          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Open Concrete Yard C</strong>
              <span className="badge badge-accent">42% Full</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Storable Commodities: Onion, Cotton</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>
              850 / 2,000 <span style={{ fontSize: 11, fontWeight: 500 }}>qtl</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Available Headroom: <strong>1,150 qtl</strong> (Ample Capacity)
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
