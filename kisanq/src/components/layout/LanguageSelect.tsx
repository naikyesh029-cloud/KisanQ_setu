'use client';
import { usePathname } from 'next/navigation';
export function LanguageSelect({ locale }: { locale: string }) {
  const pathname = usePathname();
  function change(next: string) {
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.href = pathname.replace(/^\/(en|hi|mr)(?=\/|$)/, `/${next}`);
  }
  return <select aria-label="Language" className="field" style={{width:118,minHeight:38,padding:'6px 8px'}} value={locale} onChange={e=>change(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select>;
}
