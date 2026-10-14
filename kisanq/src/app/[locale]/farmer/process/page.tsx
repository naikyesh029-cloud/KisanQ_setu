import { PageHeader } from '@/components/shared/PageHeader';
import { QrCode, Scale, Sparkles, TrendingUp, ShieldCheck, Truck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function MandiProcessPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const stepsData = {
    en: [
      {
        step: 1,
        title: 'Digital Lot Registration',
        subtitle: 'Harvest Registration',
        desc: 'Enter harvest details (crop, variety, estimated quantity, and harvest date). Upload an optional crop photo to generate an instant AI pre-grade estimate.',
        icon: Sparkles,
        status: 'completed',
        time: 'Step 1 · 2 mins'
      },
      {
        step: 2,
        title: 'Slot Booking & Arrival Token',
        subtitle: 'Token & Gate Scheduling',
        desc: 'Select an open arrival window at your preferred APMC mandi. The system generates an atomic arrival token (e.g. KQ-PUN-8821) with guaranteed gate entry.',
        icon: QrCode,
        status: 'active',
        time: 'Step 2 · 1 min'
      },
      {
        step: 3,
        title: 'Gate Checkpost & Tare Weighbridge',
        subtitle: 'Gate & Weighbridge Scale',
        desc: 'Present your arrival token at the mandi gate. Vehicle drives onto Weighbridge Scale A for gross vehicle weight recording. Immutable entry logged in ledger.',
        icon: Truck,
        status: 'pending',
        time: 'Step 3 · Mandi Entry'
      },
      {
        step: 4,
        title: 'Certified Physical Inspection',
        subtitle: 'Quality Grading & Moisture',
        desc: 'Government APMC Mandi Inspector conducts physical quality grading (Grade A, B, C) and electronic moisture meter measurement. Overrides or confirms AI estimate.',
        icon: Scale,
        status: 'pending',
        time: 'Step 4 · Yard Inspection'
      },
      {
        step: 5,
        title: 'Competitive Bidding Window',
        subtitle: 'Buyer Offers & Bidding',
        desc: 'Accredited institutional buyers submit sealed offers during the active offer window. Farmer receives real-time SMS alerts and can accept the highest bid.',
        icon: TrendingUp,
        status: 'pending',
        time: 'Step 5 · Marketplace'
      },
      {
        step: 6,
        title: 'APMC Tri-Party Escrow Settlement',
        subtitle: 'Guaranteed Escrow Payout',
        desc: 'Buyer funds are locked in APMC escrow upon offer acceptance and released directly to the farmer bank account via RTGS/NEFT upon weighbridge exit pass confirmation.',
        icon: ShieldCheck,
        status: 'pending',
        time: 'Step 6 · Same-Day Payout'
      }
    ],
    hi: [
      {
        step: 1,
        title: 'डिजिटल फसल पंजीकरण',
        subtitle: 'फसल पंजीकरण',
        desc: 'फसल का विवरण (फसल, किस्म, मात्रा, कटाई तिथि) दर्ज करें। एआई प्री-ग्रेड अनुमान के लिए वैकल्पिक फोटो अपलोड करें।',
        icon: Sparkles,
        status: 'completed',
        time: 'चरण 1 · 2 मिनट'
      },
      {
        step: 2,
        title: 'स्लॉट बुकिंग एवं आगमन टोकन',
        subtitle: 'टोकन एवं स्लॉट बुकिंग',
        desc: 'अपनी पसंदीदा एपीएमसी मंडी में समय चुनें। गेट प्रवेश के लिए सिस्टम विशिष्ट टोकन (उदा. KQ-PUN-8821) जारी करता है।',
        icon: QrCode,
        status: 'active',
        time: 'चरण 2 · 1 मिनट'
      },
      {
        step: 3,
        title: 'गेट चेकपोस्ट एवं वे-ब्रिज',
        subtitle: 'गेट एवं वजन कांटा',
        desc: 'मंडी गेट पर टोकन दिखाएं। वे-ब्रिज स्केल पर वाहन का सकल वजन दर्ज होता है और लेजर में सुरक्षित प्रविष्टि होती है।',
        icon: Truck,
        status: 'pending',
        time: 'चरण 3 · मंडी प्रवेश'
      },
      {
        step: 4,
        title: 'प्रमाणित गुणवत्ता निरीक्षण',
        subtitle: 'गुणवत्ता निरीक्षण',
        desc: 'सरकारी एपीएमसी मंडी निरीक्षक द्वारा प्रत्यक्ष गुणवत्ता ग्रेडिंग (ए, बी, सी) एवं इलेक्ट्रॉनिक नमी माप की जाती है।',
        icon: Scale,
        status: 'pending',
        time: 'चरण 4 · गुणवत्ता जांच'
      },
      {
        step: 5,
        title: 'प्रतिस्पर्धी बोली खिड़की',
        subtitle: 'खरीदार बोलियां (Bidding)',
        desc: 'मान्यता प्राप्त खरीदार सक्रिय बोली खिड़की में अपनी बोलियां लगाते हैं। किसान उच्चतम बोली स्वीकार कर सकते हैं।',
        icon: TrendingUp,
        status: 'pending',
        time: 'चरण 5 · नीलामी'
      },
      {
        step: 6,
        title: 'एपीएमसी त्रिपक्षीय एस्क्रो निपटान',
        subtitle: 'एस्क्रो सुरक्षित भुगतान',
        desc: 'खरीदार की राशि एस्क्रो में सुरक्षित रहती है और गेट एग्जिट पास के बाद सीधे किसान के बैंक खाते में ट्रांसफर होती है।',
        icon: ShieldCheck,
        status: 'pending',
        time: 'चरण 6 · तत्काल भुगतान'
      }
    ],
    mr: [
      {
        step: 1,
        title: 'डिजिटल पीक नोंदणी',
        subtitle: 'पीक नोंदणी',
        desc: 'पिकाचा तपशील (पीक, वाण, प्रमाण, कापणी दिनांक) भरा. AI पूर्व-अंदाजासाठी पिकाचा फोटो अपलोड करा.',
        icon: Sparkles,
        status: 'completed',
        time: 'टप्पा 1 · 2 मिनिटे'
      },
      {
        step: 2,
        title: 'स्लॉट बुकिंग आणि आगमन टोकन',
        subtitle: 'टोकन आणि स्लॉट बुकिंग',
        desc: 'मंडीमध्ये आगमनाची वेळ निवडा. हमीप्रवेशासाठी सिस्टीम डिजिटल टोकन (उदा. KQ-PUN-8821) जारी करते.',
        icon: QrCode,
        status: 'active',
        time: 'टप्पा 2 · 1 मिनिट'
      },
      {
        step: 3,
        title: 'गेट चेकपोस्ट आणि वजनकाटा',
        subtitle: 'गेट आणि वजन काटा',
        desc: 'गेटवर टोकन दाखवून वाहनाचे वजन नोंदवा. सुरक्षित लेजरमध्ये नोंद होते.',
        icon: Truck,
        status: 'pending',
        time: 'टप्पा 3 · मंडी प्रवेश'
      },
      {
        step: 4,
        title: 'प्रमाणित गुणवत्ता तपासणी',
        subtitle: 'गुणवत्ता तपासणी',
        desc: 'शासकीय मंडी निरीक्षकाकडून प्रत्यक्ष प्रतवारी (A, B, C) आणि इलेक्ट्रॉनिक आर्द्रता मापन.',
        icon: Scale,
        status: 'pending',
        time: 'टप्पा 4 · गुणवत्ता पडताळणी'
      },
      {
        step: 5,
        title: 'स्पर्धात्मक खरेदीदार बोली',
        subtitle: 'खरेदीदार बोली (Bidding)',
        desc: 'नोंदणीकृत व्यापारी पारदर्शक बोली लावतात. सर्वोत्तम बोली एका क्लिकवर स्वीकारा.',
        icon: TrendingUp,
        status: 'pending',
        time: 'टप्पा 5 · बाजारभाव'
      },
      {
        step: 6,
        title: 'एपीएमसी त्रिपक्षीय एस्क्रो सेटलमेंट',
        subtitle: 'एस्क्रो सुरक्षित पेमेंट',
        desc: 'व्यापाऱ्याची रक्कम एस्क्रोमध्ये सुरक्षित असते आणि वजन निश्चितीनंतर थेट शेतकऱ्याच्या खात्यात जमा होते.',
        icon: ShieldCheck,
        status: 'pending',
        time: 'टप्पा 6 · थेट पेमेंट'
      }
    ]
  };

  const steps = stepsData[locale as keyof typeof stepsData] || stepsData.en;

  return (
    <>
      <PageHeader
        eyebrow="OPERATIONAL PROTOCOL"
        title="Mandi Process & Workflow Guide"
        description="Transparent 6-stage agricultural trading pipeline from farm harvest to guaranteed APMC escrow payout."
      />

      <div style={{ display: 'grid', gap: 16 }}>
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="surface"
              style={{
                padding: 22,
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start',
                borderLeft: `5px solid ${idx === 0 ? 'var(--accent)' : 'var(--border)'}`
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <Icon size={24} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span className="eyebrow" style={{ color: 'var(--accent)' }}>{s.time}</span>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: '2px 0 0' }}>
                      {s.step}. {s.title} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>({s.subtitle})</span>
                    </h3>
                  </div>

                  <span className={`badge ${idx === 0 ? 'badge-accent' : 'badge-neutral'}`}>
                    {idx === 0 ? 'Instant Online' : 'Mandi Handover'}
                  </span>
                </div>

                <p className="muted" style={{ fontSize: 13, margin: '8px 0 0', lineHeight: 1.5 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="surface" style={{ padding: 22, marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>Ready to register your next harvest?</h4>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Create a crop lot now to get your arrival token and access buyer bids.</p>
        </div>
        <Link href={`/${locale}/farmer/lots/new`} className="btn btn-primary">
          Register Crop Lot <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
