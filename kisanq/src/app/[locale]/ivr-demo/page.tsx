import { PageHeader } from '@/components/shared/PageHeader';
import { IvrDemo } from '@/components/shared/IvrDemo';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function IvrPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="ACCESSIBILITY · FEATURE PHONE" title={d.ivr} description="Explore a phone-keypad crop-registration journey designed for non-smartphone access."/><IvrDemo dict={d}/></>}
