'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Bell, CheckCircle2, TrendingUp, TicketCheck, ShieldCheck, Clock } from 'lucide-react';

interface NotificationItem {
  id: string;
  category: 'bid' | 'queue' | 'inspection' | 'payment' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const sampleNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    category: 'bid',
    title: 'New Highest Buyer Bid Received!',
    message: 'Sahyadri Agro Traders placed a verified offer of ₹4,850/quintal on your Soybean lot (KQ-LOT-882). Accept before 14:00 to lock escrow.',
    timestamp: '10 mins ago',
    read: false
  },
  {
    id: 'notif-2',
    category: 'queue',
    title: 'Gate Queue Call-in Notification',
    message: 'Weighbridge Bay A has called in token KQ-PUN-8821. Please proceed to Mandi Gate 2 for vehicle weigh-in.',
    timestamp: '45 mins ago',
    read: false
  },
  {
    id: 'notif-3',
    category: 'payment',
    title: 'Bank Transfer Completed (RTGS)',
    message: 'APMC Escrow released ₹1,21,275 for Paddy lot (KQ-LOT-874). Transferred to HDFC Bank ··· 4821. UTR: APMC-UTR-20261013-4410.',
    timestamp: 'Yesterday',
    read: true
  },
  {
    id: 'notif-4',
    category: 'inspection',
    title: 'Weighbridge Quality Verification Passed',
    message: 'Inspector Vikram Deshmukh completed physical inspection of lot KQ-LOT-874: Grade A certified, moisture 10.8%, net weight 50.4 quintals.',
    timestamp: 'Yesterday',
    read: true
  }
];

export default function FarmerNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(sampleNotifications);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  return (
    <>
      <PageHeader
        eyebrow="REAL-TIME DISPATCH"
        title="Mandi Alerts & Notifications"
        description="Instant updates for gate queue call-ins, incoming buyer bids, weighbridge inspection grades, and bank payouts."
        action={
          <button type="button" className="btn" onClick={markAllRead} style={{ fontSize: 12 }}>
            <CheckCircle2 size={14} /> Mark all read
          </button>
        }
      />

      <div style={{ display: 'grid', gap: 12 }}>
        {notifications.map(n => {
          const getIcon = () => {
            switch (n.category) {
              case 'bid': return <TrendingUp size={18} color="#2563eb" />;
              case 'queue': return <TicketCheck size={18} color="var(--accent)" />;
              case 'payment': return <ShieldCheck size={18} color="var(--accent)" />;
              default: return <Bell size={18} color="var(--accent)" />;
            }
          };

          return (
            <div
              key={n.id}
              className="surface"
              style={{
                padding: 18,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                borderLeft: `4px solid ${n.read ? 'var(--border)' : 'var(--accent)'}`,
                background: n.read ? 'var(--surface)' : 'var(--accent-soft)'
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: 'var(--surface)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                {getIcon()}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: n.read ? 600 : 800 }}>
                    {n.title}
                  </h4>
                  <span className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {n.timestamp}
                  </span>
                </div>

                <p className="muted" style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>
                  {n.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
