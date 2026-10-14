import { Activity } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { InspectorOperations } from '@/components/shared/InspectorOperations';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function InspectorDashboard({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="MANDI OPERATIONS" title={d.inspectorTitle} description={d.inspectorSub} action={<span className="badge badge-neutral"><Activity size={13}/>Capacity + queue rules</span>}/><InspectorOperations dict={d} locale={locale}/></>}
