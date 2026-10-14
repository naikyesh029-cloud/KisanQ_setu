import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getDictionary } from '@/lib/i18n/dictionaries';
export const dynamicParams = false;
export function generateStaticParams() { return [{locale:'en'},{locale:'hi'},{locale:'mr'}]; }
export default async function LocaleLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}) {
 const {locale}=await params; if(locale!=='en'&&locale!=='hi'&&locale!=='mr') notFound(); const dict=getDictionary(locale);
 return <AppShell locale={locale} dict={dict}>{children}</AppShell>;
}
