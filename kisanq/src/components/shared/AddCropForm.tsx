'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, UploadCloud, Sparkles, RefreshCw, X } from 'lucide-react';
import type { AiQualityReport } from '@/lib/domain/aiQualityAnalyzer';

const mandis = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Pimpri Agricultural Market (Demo)' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Pune Market Yard (Demo)' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Nashik APMC (Demo)' }
];

export function AddCropForm({
  dict,
  initialParams,
  locale = 'en'
}: {
  dict: Record<string, string>;
  initialParams?: { crop?: string; pregrade?: string; confidence?: string };
  locale?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [consent, setConsent] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(initialParams?.crop || '');
  const [pregrade, setPregrade] = useState<string | null>(initialParams?.pregrade || null);
  const [pregradeConfidence, setPregradeConfidence] = useState<number | null>(
    initialParams?.confidence ? Number(initialParams.confidence) : null
  );
  const [gradingMetadata, setGradingMetadata] = useState<Record<string, unknown> | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (initialParams?.crop) setSelectedCrop(initialParams.crop);
    if (initialParams?.pregrade) setPregrade(initialParams.pregrade);
    if (initialParams?.confidence) setPregradeConfidence(Number(initialParams.confidence));
  }, [initialParams]);

  async function handlePhotoChange(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP).');
      return;
    }

    setAnalyzingPhoto(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);

      try {
        const cropName = selectedCrop || 'Crop';
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const samples: { r: number; g: number; b: number }[] = [];
          if (ctx) {
            const size = 64;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(img, 0, 0, size, size);
            const imgData = ctx.getImageData(0, 0, size, size);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 16) {
              samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
            }
          }

          try {
            const res = await fetch('/api/analyze-crop', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ crop: cropName, imageBase64: base64, samples })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Photo analysis failed.');

            const rep: AiQualityReport = data.report;
            setPregrade(rep.grade);
            setPregradeConfidence(rep.confidence);
            setGradingMetadata({
              defectPercentage: rep.defectPercentage,
              uniformityScore: rep.uniformityScore,
              estimatedMoisturePct: rep.estimatedMoisturePct,
              primaryDefect: rep.primaryDefect,
              method: rep.method,
              analyzedAt: rep.analyzedAt
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not analyze crop photo.');
          } finally {
            setAnalyzingPhoto(false);
          }
        };
        img.onerror = () => {
          setAnalyzingPhoto(false);
          setError('Could not decode the image file.');
        };
        img.src = base64;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not analyze crop photo.');
        setAnalyzingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function submit(formData: FormData) {
    setError('');
    setSuccess('');
    if (!consent) {
      setError(dict.consentRequired);
      return;
    }
    setBusy(true);

    const entries = Object.fromEntries(formData.entries());
    const body: Record<string, unknown> = {
      ...entries,
      crop: selectedCrop || entries.crop,
      consentAccepted: consent,
      aiPregrade: pregrade ?? undefined,
      aiPregradeConfidence: pregradeConfidence ?? undefined,
      gradingMetadata: gradingMetadata ?? undefined
    };

    try {
      const response = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? dict.error);
      setSuccess(`${dict.success} Lot reference: ${result.lot?.id ?? 'created'}. Redirecting to My Lots…`);
      router.refresh();
      setTimeout(() => {
        router.push(`/${locale}/farmer/lots`);
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  const label = (key: string) => dict[key] ?? key;

  return (
    <form action={submit} className="surface" style={{ padding: 22, maxWidth: 900 }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="field-label" htmlFor="crop">
            {label('crop')} *
          </label>
          <select
            id="crop"
            name="crop"
            className="field"
            required
            value={selectedCrop}
            onChange={e => setSelectedCrop(e.target.value)}
          >
            <option value="" disabled>
              Select crop
            </option>
            {['Paddy', 'Soybean', 'Onion', 'Tomato', 'Wheat', 'Cotton', 'Spinach', 'Maize', 'Potato'].map(x => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="variety">
            {label('variety')} *
          </label>
          <input
            id="variety"
            name="variety"
            className="field"
            required
            maxLength={100}
            placeholder="e.g. Lokwan"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="area">
            {label('area')} *
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="area"
              name="area"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              className="field"
              required
            />
            <select name="areaUnit" aria-label="Area unit" className="field" style={{ width: 130 }}>
              <option value="acre">Acre</option>
              <option value="hectare">Hectare</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="harvestDate">
            {label('harvestDate')} *
          </label>
          <input
            id="harvestDate"
            name="harvestDate"
            type="date"
            className="field"
            required
            max={new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Kolkata',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).format(new Date())}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="quantity">
            {label('quantity')} *
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              className="field"
              required
            />
            <select name="unit" defaultValue="kg" className="field" style={{ width: 130 }} aria-label="Quantity unit">
              <option value="kg">Kilogram</option>
              <option value="quintal">Quintal</option>
              <option value="tonne">Tonne</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="condition">
            {label('condition')} *
          </label>
          <select id="condition" name="condition" className="field" required>
            <option value="good">{label('good')}</option>
            <option value="excellent">{label('excellent')}</option>
            <option value="fair">{label('fair')}</option>
            <option value="needs_review">{label('needsReview')}</option>
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="mandiId">
            {label('mandi')} *
          </label>
          <select id="mandiId" name="mandiId" className="field" required>
            {mandis.map(m => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: 11, margin: '5px 0 0' }}>
            Demonstration mandi records; configure your own mandi IDs in Supabase.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="moisturePct">
            {label('moisture')}
          </label>
          <input
            id="moisturePct"
            name="moisturePct"
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="field"
            placeholder="Optional (Probe verified at gate)"
          />
          <p className="muted" style={{ fontSize: 11, margin: '5px 0 0' }}>
            Farmers are not expected to know exact moisture. Digital probe test will confirm at mandi weighbridge gate.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="askingPrice">
            {label('askingPrice')}
          </label>
          <input
            id="askingPrice"
            name="askingPrice"
            type="number"
            min="0.01"
            step="0.01"
            className="field"
            placeholder="Optional"
          />
        </div>

        {/* AI Photo & Pre-Grade Scanner */}
        <div>
          <label className="field-label" htmlFor="photo-upload">
            Crop Photo & AI Pre-Grade (Standard Quality Check)
          </label>

          <input
            ref={fileInputRef}
            id="photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files?.[0]) handlePhotoChange(e.target.files[0]);
            }}
          />

          {imagePreview ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Crop sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {analyzingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', color: '#fff' }}>
                    <RefreshCw className="animate-spin" size={16} />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {pregrade ? (
                  <div>
                    <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                      <Sparkles size={12} /> AI Pre-Grade: {pregrade} ({pregradeConfidence ?? 85}%)
                    </span>
                    <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>
                      {label('pregradeNote')}
                    </p>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {analyzingPhoto ? 'Analyzing image pixels…' : 'Photo uploaded.'}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn"
                style={{ padding: 6, height: 'auto' }}
                title="Remove photo"
                onClick={() => {
                  setImagePreview(null);
                  setPregrade(null);
                  setPregradeConfidence(null);
                  setGradingMetadata(null);
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                className="field"
                style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={18} color="var(--accent)" />
                <span style={{ fontSize: 13 }}>Upload photo for instant AI Pre-Grade</span>
              </button>
              <p className="muted" style={{ fontSize: 11, margin: '5px 0 0' }}>
                Standard visual scan estimates grade and moisture. If no photo is available now, official physical inspection & grading will be completed at the weighbridge.
              </p>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="field-label" htmlFor="description">
            {label('description')}
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={1000}
            className="field"
            rows={3}
            placeholder="Optional lot notes"
          />
        </div>
      </div>

      <div className="divider" style={{ margin: '22px 0' }} />

      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg)', marginBottom: 16 }}>
        <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 5 }}>Data use and consent</div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
          {label('privacy')}
        </p>
        <label style={{ display: 'flex', alignItems: 'start', gap: 9, fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          {label('consent')}
        </label>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--danger)', marginBottom: 14, fontSize: 12 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div role="status" style={{ display: 'flex', gap: 8, color: 'var(--accent)', marginBottom: 14, fontSize: 12 }}>
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="reset"
          className="btn"
          onClick={() => {
            setError('');
            setSuccess('');
            setConsent(false);
            setImagePreview(null);
            setPregrade(null);
            setPregradeConfidence(null);
          }}
        >
          {label('cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || analyzingPhoto}>
          {busy ? 'Submitting…' : label('submit')}
        </button>
      </div>
    </form>
  );
}
