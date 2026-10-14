import { PageHeader } from '@/components/shared/PageHeader';
import { FarmerLots } from '@/components/shared/FarmerLots';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function FarmerLotsPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="FARMER WORKSPACE" title={d.myLots} description="Track your harvest registration, mandi queue, inspection and buyer offer status."/><FarmerLots locale={locale} dict={d}/></>}
