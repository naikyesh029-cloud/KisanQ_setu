import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
export const metadata: Metadata = { title: 'KisanQ — Fair markets. Faster decisions.', description: 'A transparent agricultural mandi platform for farmers, buyers and mandi inspectors.' };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const jar=await cookies(); const theme=jar.get('kisanq-theme')?.value; const rawLocale=jar.get('NEXT_LOCALE')?.value; const lang=rawLocale==='hi'||rawLocale==='mr'?rawLocale:'en'; return <html lang={lang} className={theme==='dark'?'dark':undefined} suppressHydrationWarning><body>{children}</body></html>; }
