'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Layers,
  Droplets,
  Scan,
  RefreshCw
} from 'lucide-react';
import type { AiQualityReport, RgbColor } from '@/lib/domain/aiQualityAnalyzer';

interface AiQualityAnalyzerProps {
  locale: string;
  initialCrop?: string;
  onGraded?: (grade: string, confidence: number, report: AiQualityReport) => void;
}

const COMMON_CROPS = [
  'Tomato',
  'Onion',
  'Wheat',
  'Paddy',
  'Soybean',
  'Potato',
  'Cotton',
  'Spinach',
  'Maize'
];

export function AiQualityAnalyzer({
  locale,
  initialCrop = 'Tomato',
  onGraded
}: AiQualityAnalyzerProps) {
  const [crop, setCrop] = useState(initialCrop);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AiQualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Samples pixels from an image element using an offscreen canvas
   */
  function sampleCanvasPixels(img: HTMLImageElement): RgbColor[] {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const size = 64; // 64x64 thumbnail for fast, representative sampling
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const samples: RgbColor[] = [];

    // Step through pixels
    for (let i = 0; i < data.length; i += 16) {
      samples.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      });
    }
    return samples;
  }

  async function handleFileSelected(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large (maximum 10MB).');
      return;
    }

    setAnalyzing(true);
    setReport(null);

    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);

      try {
        // Load image to extract canvas pixels
        const img = new Image();
        img.onload = async () => {
          const clientSamples = sampleCanvasPixels(img);

          try {
            const res = await fetch('/api/analyze-crop', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                crop,
                imageBase64: base64,
                samples: clientSamples
              })
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Failed to analyze crop image');
            }

            const rep: AiQualityReport = data.report;
            setReport(rep);
            if (onGraded) {
              onGraded(rep.grade, rep.confidence, rep);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Quality analysis request failed.');
          } finally {
            setAnalyzing(false);
          }
        };
        img.onerror = () => {
          setError('Could not decode the image file.');
          setAnalyzing(false);
        };
        img.src = base64;
      } catch {
        setError('Error reading image.');
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function getGradeBadgeStyle(grade: string) {
    switch (grade) {
      case 'A':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', label: 'Grade A · Premium Quality' };
      case 'B':
        return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'Grade B · Standard Quality' };
      case 'C':
        return { bg: '#fffbeb', text: '#92400e', border: '#fde68a', label: 'Grade C · Commercial Discount' };
      default:
        return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', label: 'Rejected · Non-Marketable' };
    }
  }

  return (
    <div className="surface" style={{ padding: 24, maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            <Sparkles size={13} />
            Deterministic Computer Vision · $0 Cost
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
            AI Crop Quality Pre-Grading
          </h2>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
            Instant optical analysis of color distribution, surface blemishes, and moisture proxy.
          </p>
        </div>

        <div>
          <label htmlFor="analyzer-crop-select" className="field-label" style={{ fontSize: 11, marginBottom: 3 }}>
            Target Crop
          </label>
          <select
            id="analyzer-crop-select"
            className="field"
            value={crop}
            onChange={e => {
              setCrop(e.target.value);
              if (imagePreview && fileInputRef.current?.files?.[0]) {
                handleFileSelected(fileInputRef.current.files[0]);
              }
            }}
            style={{ width: 160, padding: '6px 10px', fontSize: 13 }}
          >
            {COMMON_CROPS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          cursor: 'pointer',
          background: 'var(--bg)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 20
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
          }}
        />

        {imagePreview ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 200, height: 160, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Selected harvest"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {analyzing && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', color: '#fff' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <RefreshCw className="animate-spin" size={24} />
                    <span>Scanning pixels…</span>
                  </div>
                </div>
              )}
            </div>
            <span className="btn" style={{ fontSize: 12, padding: '5px 12px' }}>
              <Upload size={13} /> Change Harvest Photo
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
              <Scan size={22} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Click or drag harvest sample image here
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Supports JPG, PNG, or WebP. Take a photo in even daylight showing crop surface.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <XCircle size={16} />
          {error}
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          {/* Main Grade Header */}
          {(() => {
            const badge = getGradeBadgeStyle(report.grade);
            return (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 18
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: badge.text }}>
                    {report.crop} Quality Assessment
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 900, color: badge.text, marginTop: 2 }}>
                    {badge.label}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: badge.text }}>Model Confidence</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: badge.text }}>{report.confidence}%</div>
                </div>
              </div>
            );
          })()}

          {/* Key Metrics Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
            <div className="surface" style={{ padding: 12, background: 'var(--bg)', boxShadow: 'none' }}>
              <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                <Layers size={12} /> Uniformity
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                {report.uniformityScore}<span style={{ fontSize: 11, fontWeight: 500 }}>/100</span>
              </div>
            </div>

            <div className="surface" style={{ padding: 12, background: 'var(--bg)', boxShadow: 'none' }}>
              <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                <AlertTriangle size={12} /> Defect Ratio
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                {report.defectPercentage}%
              </div>
            </div>

            <div className="surface" style={{ padding: 12, background: 'var(--bg)', boxShadow: 'none' }}>
              <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                <Droplets size={12} /> Est. Moisture
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                {report.estimatedMoisturePct}%
              </div>
            </div>

            <div className="surface" style={{ padding: 12, background: 'var(--bg)', boxShadow: 'none' }}>
              <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                <CheckCircle2 size={12} /> Consistency
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                {report.metrics.colorConsistency}<span style={{ fontSize: 11, fontWeight: 500 }}>/100</span>
              </div>
            </div>
          </div>

          {/* Observations & Advisory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 18 }}>
            <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg)' }}>
              <strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Visual Observations</strong>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }} className="muted">
                {report.observations.map((obs, idx) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            </div>

            <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg)' }}>
              <strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Mandi Advisory</strong>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }} className="muted">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Physical Verification Disclaimer */}
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--text)', fontSize: 11, display: 'flex', gap: 8, alignItems: 'start', marginBottom: 20 }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
            <div>
              <strong>APMC Regulatory Notice: </strong>
              {report.disclaimer}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Link
              href={`/${locale}/farmer/lots/new?crop=${encodeURIComponent(report.crop)}&pregrade=${report.grade}&confidence=${report.confidence}`}
              className="btn btn-primary"
              style={{ fontSize: 13 }}
            >
              <span>Register Lot With Pre-Grade ({report.grade})</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
