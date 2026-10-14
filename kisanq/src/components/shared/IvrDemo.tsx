'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  PhoneCall,
  RotateCcw,
  Volume2,
  VolumeX,
  MessageSquare,
  Sparkles
} from 'lucide-react';

type Step = 'welcome' | 'crop' | 'variety' | 'quantity' | 'mandi' | 'confirm' | 'complete';

const prompts: Record<Step, { en: string; hi: string; translitHi: string }> = {
  welcome: {
    en: 'Welcome to KisanQ Mandi Voice Service. Press 1 to register a harvest crop lot, or 9 to restart.',
    hi: 'किसानक्यू मंडी वॉयस सेवा में आपका स्वागत है। फसल पंजीकरण के लिए 1 दबाएं, या पुनः आरंभ करने के लिए 9 दबाएं।',
    translitHi: 'KisanQ Mandi Voice Seva me aapka swaagat hai. Fasal panjikaran ke liye ek dabaayein, ya restart ke liye nau dabaayein.'
  },
  crop: {
    en: 'Select your crop: Press 1 for Wheat, 2 for Paddy, or 3 for Soybean.',
    hi: 'अपनी फसल चुनें: गेहूं के लिए 1 दबाएं, धान के लिए 2 दबाएं, सोयाबीन के लिए 3 दबाएं।',
    translitHi: 'Apni fasal chunein: Gehun ke liye ek dabaayein, Dhaan ke liye do dabaayein, Soybean ke liye teen dabaayein.'
  },
  variety: {
    en: 'Select crop grade: Press 1 for Common Standard, 2 for Premium Quality.',
    hi: 'गुणवत्ता चुनें: सामान्य मानक के लिए 1 दबाएं, प्रीमियम गुणवत्ता के लिए 2 दबाएं।',
    translitHi: 'Gunnvatta chunein: Samanya manak ke liye ek dabaayein, Premium gunnvatta ke liye do dabaayein.'
  },
  quantity: {
    en: 'Enter your harvest quantity in quintals using the keypad, then press hash (#).',
    hi: 'कीपैड का उपयोग करके क्विंटल में मात्रा दर्ज करें, फिर हैश (#) दबाएं।',
    translitHi: 'Keypad ka upyog karke quintal me maatra darj karein, fir hash dabayein.'
  },
  mandi: {
    en: 'Select your target mandi: Press 1 for Pimpri, 2 for Pune Market Yard, 3 for Nashik APMC.',
    hi: 'मंडी चुनें: पिंपरी के लिए 1, पुणे मार्केट यार्ड के लिए 2, नाशिक एपीएमसी के लिए 3 दबाएं।',
    translitHi: 'Mandi chunein: Pimpri ke liye ek, Pune Market Yard ke liye do, Nashik APMC ke liye teen dabayein.'
  },
  confirm: {
    en: 'Press 1 to confirm and book your mandi arrival token, or press 2 to go back.',
    hi: 'अपने टोकन की पुष्टि और बुकिंग के लिए 1 दबाएं, या वापस जाने के लिए 2 दबाएं।',
    translitHi: 'Apne arrival token ki pushti aur booking ke liye ek dabayein, ya wapas jaane ke liye do dabayein.'
  },
  complete: {
    en: 'Your arrival slot token has been booked. A confirmation SMS has been dispatched to your mobile.',
    hi: 'आपका मंडी आगमन टोकन सफलतापूर्वक बुक हो गया है। आपके मोबाइल पर पुष्टि एसएमएस भेज दिया गया है।',
    translitHi: 'Aapka mandi aagaman token safaltapoorvak book ho gaya hai. Aapke mobile par SMS bhej diya gaya hai.'
  }
};

export function IvrDemo({ dict }: { dict: Record<string, string> }) {
  const [step, setStep] = useState<Step>('welcome');
  const [crop, setCrop] = useState('');
  const [variety, setVariety] = useState('');
  const [quantity, setQuantity] = useState('');
  const [mandi, setMandi] = useState('');
  const [demoToken, setDemoToken] = useState('');
  const [last, setLast] = useState('');
  const [error, setError] = useState('');
  const [voiceLang, setVoiceLang] = useState<'hi' | 'en'>('en');
  const [voiceActive, setVoiceActive] = useState(false);

  const speakPrompt = useCallback(
    (stepKey: Step, lang: 'hi' | 'en') => {
      if (!voiceActive || typeof window === 'undefined' || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const p = prompts[stepKey];
        const voices = window.speechSynthesis.getVoices();
        const hindiVoice = voices.find(
          v =>
            v.lang.startsWith('hi') ||
            v.lang.startsWith('mr') ||
            v.name.toLowerCase().includes('hindi') ||
            v.name.toLowerCase().includes('india')
        );

        let utteranceText = p[lang];
        let utteranceLang = lang === 'hi' ? 'hi-IN' : 'en-IN';

        // If Hindi requested on an OS lacking native Hindi speech packs, use phonetic text so words aren't skipped
        if (lang === 'hi' && !hindiVoice) {
          utteranceText = p.translitHi;
          utteranceLang = 'en-IN';
        }

        const utterance = new SpeechSynthesisUtterance(utteranceText);
        utterance.lang = utteranceLang;
        if (hindiVoice && lang === 'hi') utterance.voice = hindiVoice;
        utterance.rate = 0.92;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Fallback gracefully
      }
    },
    [voiceActive]
  );

  useEffect(() => {
    if (voiceActive) {
      speakPrompt(step, voiceLang);
    }
  }, [step, voiceActive, voiceLang, speakPrompt]);

  function resetSession() {
    setError('');
    setStep('welcome');
    setCrop('');
    setVariety('');
    setQuantity('');
    setMandi('');
    setDemoToken('');
  }

  function goBackStep() {
    setError('');
    setStep(
      step === 'complete'
        ? 'confirm'
        : step === 'confirm'
        ? 'mandi'
        : step === 'mandi'
        ? 'quantity'
        : step === 'quantity'
        ? 'variety'
        : step === 'variety'
        ? 'crop'
        : 'welcome'
    );
  }

  function press(key: string) {
    setError('');
    setLast(key);
    if (key === '9' && step !== 'quantity') {
      resetSession();
      return;
    }
    if (key === '*') {
      if (step === 'quantity' && quantity.length > 0) {
        setQuantity((q) => q.slice(0, -1));
        return;
      }
      goBackStep();
      return;
    }

    switch (step) {
      case 'welcome':
        if (key === '1') setStep('crop');
        else setError('Invalid choice. Press 1 to start or 9 to restart.');
        break;
      case 'crop':
        if (!['1', '2', '3'].includes(key)) {
          setError('Choose 1 (Wheat), 2 (Paddy), or 3 (Soybean).');
          break;
        }
        setCrop(({ 1: 'Wheat', 2: 'Paddy', 3: 'Soybean' } as Record<string, string>)[key]);
        setStep('variety');
        break;
      case 'variety':
        if (!['1', '2'].includes(key)) {
          setError('Choose 1 for Standard or 2 for Premium.');
          break;
        }
        setVariety(key === '1' ? 'Common Standard' : 'Premium Quality');
        setStep('quantity');
        break;
      case 'quantity':
        if (key === '#') {
          if (!quantity || Number(quantity) <= 0) {
            setError('Enter a quantity greater than zero first.');
            break;
          }
          setStep('mandi');
        } else if (/^\d$/.test(key) && quantity.length < 5) {
          setQuantity((q) => q + key);
        }
        break;
      case 'mandi':
        if (!['1', '2', '3'].includes(key)) {
          setError('Choose 1 (Pimpri), 2 (Pune), or 3 (Nashik).');
          break;
        }
        setMandi(
          (
            {
              1: 'Pimpri Agricultural Market',
              2: 'Pune Market Yard',
              3: 'Nashik APMC'
            } as Record<string, string>
          )[key]
        );
        setStep('confirm');
        break;
      case 'confirm':
        if (key === '1') {
          const generated = `KQ-${crop.toUpperCase().slice(0, 3)}-${quantity.padStart(4, '0')}`;
          setDemoToken(generated);
          setStep('complete');
        } else if (key === '2') {
          setStep('mandi');
        } else {
          setError('Press 1 to confirm or 2 to go back.');
        }
        break;
      case 'complete':
        setError('Call completed. Press 9 to restart a new registration.');
        break;
    }
  }

  const stepOrder: Step[] = ['welcome', 'crop', 'variety', 'quantity', 'mandi', 'confirm', 'complete'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Phone Simulator Panel */}
      <section className="surface" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                height: 46,
                width: 46,
                borderRadius: 14,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <PhoneCall size={22} />
            </div>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>Rural Voice IVR Call</h2>
              <p className="muted" style={{ fontSize: 11, margin: '2px 0 0' }}>
                Offline-capable voice agent for non-smartphone farmers
              </p>
            </div>
          </div>

            {/* Zero-Cost Voice Audio Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn"
              onClick={() => {
                const next = !voiceActive;
                setVoiceActive(next);
                if (next) speakPrompt(step, voiceLang);
                else if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
              }}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: voiceActive ? 'var(--accent)' : 'var(--surface)',
                color: voiceActive ? '#fff' : 'var(--text)',
                borderColor: voiceActive ? 'var(--accent)' : 'var(--border)'
              }}
              title="Speak prompts aloud in real-time"
            >
              {voiceActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {voiceActive ? 'Voice Audio: ON' : 'Enable Voice'}
            </button>
            {voiceActive && (
              <button
                className="btn"
                onClick={() => {
                  const nextLang = voiceLang === 'en' ? 'hi' : 'en';
                  setVoiceLang(nextLang);
                  speakPrompt(step, nextLang);
                }}
                style={{ fontSize: 11, padding: '6px 9px' }}
              >
                {voiceLang === 'en' ? '🇮🇳 हिन्दी' : '🇬🇧 English'}
              </button>
            )}
          </div>
        </div>

        {/* Realistic Phone Display Terminal */}
        <div
          style={{
            background: '#0c1b12',
            border: '1px solid #1c3d28',
            color: '#d1fae5',
            borderRadius: 16,
            padding: 20,
            marginTop: 20,
            minHeight: 160,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.75, letterSpacing: '0.1em' }}>
              <span>KISANQ TOLL-FREE: 1800-KISAN-Q</span>
              <span>{voiceActive ? '🔊 AUDIO ACTIVE' : 'MUTED'}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12, lineHeight: 1.45 }}>
              {prompts[step][voiceLang]}
            </div>
            {voiceLang === 'en' && (
              <div style={{ fontSize: 12, color: '#86efac', marginTop: 6, fontStyle: 'italic', opacity: 0.85 }}>
                {prompts[step].hi}
              </div>
            )}
            {step === 'quantity' && quantity && (
              <div style={{ fontSize: 14, marginTop: 10, color: '#34d399', fontWeight: 800 }}>
                Entered: {quantity} Quintals (Press # to confirm, * to erase)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #1c3d28', fontSize: 11, opacity: 0.8 }}>
            <span>Last Dialed Key: <strong>{last || 'None'}</strong></span>
            <span>Step {stepOrder.indexOf(step) + 1} of 7</span>
          </div>
        </div>

        {/* DTMF Keypad (Large targets for easy touchscreen use) */}
        <div className="grid grid-cols-3 gap-3" style={{ maxWidth: 320, margin: '22px auto 16px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
            <button
              key={k}
              className="btn"
              style={{
                minHeight: 52,
                fontSize: 19,
                fontWeight: 750,
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
              onClick={() => press(k)}
              aria-label={`Dial ${k}`}
            >
              {k}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn" onClick={goBackStep} style={{ fontSize: 12 }}>
            <ArrowLeft size={14} />
            {dict.back}
          </button>
          <button className="btn" onClick={resetSession} style={{ fontSize: 12 }}>
            <RotateCcw size={14} />
            {dict.restart}
          </button>
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 14, textAlign: 'center', fontWeight: 600 }}>
            {error}
          </p>
        )}
      </section>

      {/* Real-Time Call Progress & SMS Simulation Panel */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Call Summary */}
        <div className="surface" style={{ padding: 24 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Call Record & Data Dispatch</h2>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 16px' }}>
            Live parameters captured from DTMF audio frequency responses
          </p>

          <div style={{ display: 'grid', gap: 0 }}>
            {[
              { label: 'Crop Selection', value: crop || 'Pending keypad input' },
              { label: 'Quality Grade', value: variety || 'Pending keypad input' },
              { label: 'Estimated Quantity', value: quantity ? `${quantity} Quintals` : 'Pending keypad input' },
              { label: 'Destination Mandi', value: mandi || 'Pending keypad input' }
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <span className="muted" style={{ fontSize: 12 }}>{row.label}</span>
                <strong style={{ fontSize: 12, textAlign: 'right' }}>{row.value}</strong>
              </div>
            ))}
          </div>

          {step === 'complete' && (
            <div
              role="status"
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 14,
                borderRadius: 12,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                marginTop: 18
              }}
            >
              <CheckCircle2 size={24} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--accent)' }}>Arrival Token Issued</strong>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  Booking Reference: <strong style={{ letterSpacing: '0.05em' }}>{demoToken}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div style={{ marginTop: 20 }}>
            <div className="eyebrow">Call Session Progress</div>
            <div style={{ fontWeight: 750, marginTop: 4, fontSize: 13 }}>
              Step {stepOrder.indexOf(step) + 1} of {stepOrder.length} ({step})
            </div>
            <div style={{ height: 6, borderRadius: 6, background: 'var(--border)', marginTop: 8, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${((stepOrder.indexOf(step) + 1) / stepOrder.length) * 100}%`,
                  background: 'var(--accent)',
                  transition: 'width .2s ease'
                }}
              />
            </div>
          </div>
        </div>

        {/* SMS Notification Preview */}
        <div className="surface" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <MessageSquare size={18} color="var(--accent)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Farmer Mobile SMS Dispatch Preview</h3>
          </div>
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.55
            }}
          >
            {step === 'complete' ? (
              <div>
                <strong>[KISANQ APMC ALERT]</strong>
                <br />
                Namaste! Your {crop} ({quantity} Qtl) has been booked for {mandi}.
                <br />
                Arrival Token: <strong>{demoToken}</strong>.
                <br />
                Present this code at Mandi Weighbridge Gate 1.
              </div>
            ) : (
              <span className="muted">
                Complete the IVR call prompts on the left to trigger the automatic SMS confirmation dispatch.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Production Telephony & Zero-Cost Architecture Explanation */}
      <div className="lg:col-span-2 surface" style={{ padding: 20, background: 'var(--bg)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Sparkles size={16} color="var(--accent)" />
          <strong style={{ fontSize: 13 }}>Why Rural IVR & How It Operates at Zero Telephony Cost</strong>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 10px', lineHeight: 1.6 }}>
          Over 60% of smallholder farmers in rural APMC catchment zones use basic 2G feature phones or struggle with digital form typing. KisanQ solves this through Interactive Voice Response (IVR): farmers dial a toll-free number or send a missed call to book arrival tokens and receive SMS bid updates in their local language.
        </p>
        <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          <strong>For Demo / Hackathon evaluation:</strong> The browser Web Speech API provides a completely zero-cost interactive voice simulation without third-party telecom bills. <strong>For Enterprise Deployment:</strong> KisanQ connects to carrier gateways (e.g. Exotel, Gupshup, or Twilio) via webhook webhooks that invoke the exact same validated database APIs.
        </p>
      </div>
    </div>
  );
}
