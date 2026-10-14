'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Gavel, Plus, ShieldCheck, FileText } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Dispute = {
  id: string;
  lot_id: string | null;
  offer_id: string | null;
  reason_code: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
};

type LotOption = {
  id: string;
  crop: string;
  variety: string;
};

export function DisputeDesk({ dict }: { dict: Record<string, string> }) {
  const [items, setItems] = useState<Dispute[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [myLots, setMyLots] = useState<LotOption[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('quality');
  const [description, setDescription] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [customRef, setCustomRef] = useState('');
  const [activeDispute, setActiveDispute] = useState<Dispute | null>(null);
  const [nextStatus, setNextStatus] = useState<'under_review' | 'resolved' | 'rejected'>('under_review');
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    // 1. Fetch user role
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        sb.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
          if (data?.role) setUserRole(data.role);
        });
      }
    });

    // 2. Fetch disputes
    fetch('/api/disputes')
      .then(async r => {
        const d = await r.json();
        if (r.ok) setItems(d.disputes ?? []);
        else setError(d.error ?? dict.error);
      })
      .catch(() => setError(dict.error));

    // 3. Fetch lots for dropdown
    fetch('/api/lots')
      .then(async r => {
        const d = await r.json();
        if (r.ok && Array.isArray(d.lots)) {
          setMyLots(d.lots.map((l: { id: string; crop: string; variety: string }) => ({ id: l.id, crop: l.crop, variety: l.variety })));
        }
      })
      .catch(() => {});
  }, [dict.error]);

  async function create() {
    const lotIdToUse = selectedLotId || customRef.trim();
    if (!lotIdToUse) {
      setError('Please select or specify a lot or offer reference.');
      return;
    }
    if (description.trim().length < 8) {
      setError('Please provide at least 8 characters describing the issue.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: lotIdToUse,
          reasonCode: reason,
          description: description.trim()
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? dict.error);

      setItems(prev => [
        {
          id: d.dispute.id,
          lot_id: d.dispute.lot_id ?? lotIdToUse,
          offer_id: d.dispute.offer_id ?? null,
          reason_code: reason,
          description: description.trim(),
          status: d.dispute.status,
          resolution: null,
          created_at: d.dispute.created_at
        },
        ...prev
      ]);
      setMode(false);
      setDescription('');
      setSelectedLotId('');
      setCustomRef('');
      setNotice(`Dispute reference #${d.dispute.id.slice(0, 8).toUpperCase()} submitted successfully. A Mandi Inspector or Supervisor will review your case.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  async function updateDispute() {
    if (!activeDispute) return;
    if (resolutionNote.trim().length < 8) {
      setError('Resolution note must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch(`/api/disputes/${activeDispute.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, resolution: resolutionNote.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? dict.error);

      setItems(prev =>
        prev.map(item =>
          item.id === activeDispute.id
            ? { ...item, status: d.dispute.status, resolution: d.dispute.resolution }
            : item
        )
      );
      setActiveDispute(null);
      setResolutionNote('');
      setNotice(`Dispute #${activeDispute.id.slice(0, 8).toUpperCase()} updated to ${d.dispute.status.replaceAll('_', ' ')}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setBusy(false);
    }
  }

  const isArbitrator = userRole === 'supervisor' || userRole === 'inspector';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {isArbitrator ? 'Mandi Dispute Arbitration & Resolution Desk' : 'APMC Dispute Desk'}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {isArbitrator
              ? 'Review claims, inspect physical weighbridge records, and record official binding arbitration decisions.'
              : 'Registered farmers and buyers can raise disputes regarding weight, quality grading, offer procedures, or token delays.'}
          </div>
        </div>

        {/* Only Farmers and Buyers raise disputes; Supervisors and Inspectors arbitrate */}
        {!isArbitrator && (
          <button className="btn btn-primary" onClick={() => { setMode(v => !v); setActiveDispute(null); setError(''); }}>
            <Plus size={15} /> Raise a dispute
          </button>
        )}
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--danger)', fontSize: 12, marginBottom: 16 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {notice && (
        <div role="status" style={{ display: 'flex', gap: 8, color: 'var(--accent)', fontSize: 12, marginBottom: 16 }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Raise Dispute Form (Farmer / Buyer only) */}
      {mode && !isArbitrator && (
        <div className="surface" style={{ padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FileText size={18} color="var(--accent)" />
            <h2 className="section-title" style={{ margin: 0 }}>Register New Mandi Dispute</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="dispute-reason">Reason Code *</label>
              <select id="dispute-reason" className="field" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="quality">Quality / Grade Discrepancy</option>
                <option value="weight">Weighbridge Weight Mismatch</option>
                <option value="payment">Escrow / Payment Clearance</option>
                <option value="offer_process">Offer Window Process</option>
                <option value="token_slot">Arrival Token & Slot Queue</option>
                <option value="other">Other Operational Dispute</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="lot-select">Related Lot Reference *</label>
              {myLots.length > 0 ? (
                <select
                  id="lot-select"
                  className="field"
                  value={selectedLotId}
                  onChange={e => setSelectedLotId(e.target.value)}
                >
                  <option value="">Choose from your active lots</option>
                  {myLots.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.crop} - {l.variety} (#{l.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="lot-select"
                  className="field"
                  value={customRef}
                  onChange={e => setCustomRef(e.target.value)}
                  placeholder="Enter Lot UUID or Offer UUID"
                />
              )}
            </div>

            <div className="md:col-span-2">
              <label className="field-label" htmlFor="dispute-desc">
                Detailed Explanation * (min 8 characters)
              </label>
              <textarea
                id="dispute-desc"
                className="field"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what occurred, discrepancies observed, and requested correction…"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={() => setMode(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Submitting…' : 'Submit Dispute'}
            </button>
          </div>
        </div>
      )}

      {/* Review & Arbitrate Modal (Inspector / Supervisor only) */}
      {activeDispute && isArbitrator && (
        <div className="surface" style={{ padding: 22, marginBottom: 20, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldCheck size={18} color="var(--accent)" />
            <h2 className="section-title" style={{ margin: 0 }}>
              Arbitrate Dispute · #{activeDispute.id.slice(0, 8).toUpperCase()}
            </h2>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 16px' }}>
            Reason: <strong>{activeDispute.reason_code.replaceAll('_', ' ')}</strong> · Claim: &ldquo;{activeDispute.description}&rdquo;
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="dispute-status">Resolution Status *</label>
              <select
                id="dispute-status"
                className="field"
                value={nextStatus}
                onChange={e => setNextStatus(e.target.value as 'under_review' | 'resolved' | 'rejected')}
              >
                {activeDispute.status === 'open' && <option value="under_review">Mark Under Review</option>}
                <option value="resolved">Approve & Resolve Claim</option>
                <option value="rejected">Reject Claim</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="field-label" htmlFor="dispute-resolution">
                Arbitration Notes & Justification * (min 8 characters)
              </label>
              <textarea
                id="dispute-resolution"
                className="field"
                rows={3}
                value={resolutionNote}
                onChange={e => setResolutionNote(e.target.value)}
                placeholder="Record weighbridge re-check findings, quality re-test results, and final settlement agreement…"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={() => { setActiveDispute(null); setResolutionNote(''); }}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || resolutionNote.trim().length < 8} onClick={updateDispute}>
              {busy ? 'Updating…' : 'Record Official Decision'}
            </button>
          </div>
        </div>
      )}

      {/* Disputes Table or Empty State */}
      {items.length === 0 ? (
        <div className="surface" style={{ padding: 40, textAlign: 'center' }}>
          <Gavel size={32} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
          <h2 className="section-title">No Active Disputes</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 460, margin: '6px auto 0' }}>
            All mandi transactions, physical inspections, and buyer settlements are operating normally with zero recorded disputes.
          </p>
        </div>
      ) : (
        <div className="surface table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Reason</th>
                <th>Details</th>
                <th>Status</th>
                <th>Date Raised</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700 }}>#{d.id.slice(0, 8).toUpperCase()}</td>
                  <td>
                    <span className="badge badge-neutral">{d.reason_code.replaceAll('_', ' ')}</span>
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: 220, maxWidth: 380 }}>
                    <div>{d.description}</div>
                    {d.resolution && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4, color: 'var(--accent)' }}>
                        <strong>Resolution:</strong> {d.resolution}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${d.status === 'resolved' ? '' : d.status === 'rejected' ? 'badge-warn' : 'badge-neutral'}`}>
                      {d.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  <td>
                    {isArbitrator && ['open', 'under_review'].includes(d.status) ? (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => {
                          setActiveDispute(d);
                          setNextStatus(d.status === 'open' ? 'under_review' : 'resolved');
                          setResolutionNote(d.resolution ?? '');
                          setMode(false);
                        }}
                      >
                        Arbitrate
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {d.status === 'resolved' ? 'Resolved' : d.status === 'rejected' ? 'Rejected' : 'In Review'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
