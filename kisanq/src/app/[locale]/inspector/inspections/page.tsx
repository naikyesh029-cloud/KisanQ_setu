import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { InspectionForm } from '@/components/shared/InspectionForm';
import { TokenCheckIn } from '@/components/shared/TokenCheckIn';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function InspectionsPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="QUALITY CONTROL" title={d.inspections} description="Record physical grade, weight and moisture with mandatory reasons and audit history." action={<span className="badge badge-neutral"><ClipboardCheck size={13}/>Inspector record</span>}/><TokenCheckIn/><InspectionForm dict={d}/></>}
