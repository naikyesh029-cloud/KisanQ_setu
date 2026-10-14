import { Sprout } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { AddCropForm } from '@/components/shared/AddCropForm';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function AddCropPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ crop?: string; pregrade?: string; confidence?: string }>;
}) {
  const { locale } = await params;
  const sParams = await searchParams;
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader
        eyebrow="FARMER WORKSPACE"
        title={dict.createLot}
        description={dict.createLotSub}
        action={
          <span className="badge badge-neutral">
            <Sprout size={13} />
            Crop registration
          </span>
        }
      />
      <AddCropForm dict={dict} initialParams={sParams} locale={locale} />
    </>
  );
}
