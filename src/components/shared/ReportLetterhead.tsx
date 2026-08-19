'use client';

/**
 * ترويسة وتذييل المستندات المطبوعة - the printed letterhead.
 *
 * Matches the company's Word letterhead (Letterhead.docx) so anything printed or saved as
 * PDF out of this system is recognisably a Saudi Cable document rather than a screenshot of
 * a web page: the mark and company name at the head, and the registration, head-office and
 * certification block at the foot.
 *
 * BOTH BLOCKS ARE PRINT-ONLY. On screen they would be noise - the reader already knows
 * whose system they are looking at, and the sidebar says so. They are hidden with
 * `hidden print:block`, so they appear exactly where they belong: on paper.
 *
 * THE FIGURES ARE THE COMPANY'S OWN, copied from the letterhead footer and not invented
 * here. If the C.R., the paid capital or the certifications change, the letterhead is the
 * source and this is the copy that has to follow it.
 */
import { SaudiCableMark } from './SaudiCableMark';

// من تذييل Letterhead.docx - لا تُعدَّل إلا تبعاً له
const COMPANY = {
  crAr: 'شركة مساهمة سعودية - س.ت 4030009931',
  crEn: 'Saudi Joint Stock Company - C.R 4030009931',
  capitalAr: 'رأس المال المدفوع 66.729.060 ر.س',
  capitalEn: 'Paid Capital 66,729,060 S.R',
  officeAr: 'جدة (المركز الرئيسي) - ص.ب 4403، جدة 21491',
  officeEn: 'Jeddah (Head Office) - P.O. Box 4403, Jeddah 21491',
  phone: '+966 12 608 7666',
  fax: '+966 12 635 2220',
  toll: '8004400014',
  web: 'www.saudicable.com',
  certs: 'DNV ISO 9001 · ISO 45001:2018',
};

export function ReportLetterheadHeader({
  titleAr,
  titleEn,
  language = 'ar',
  meta,
}: {
  titleAr: string;
  titleEn: string;
  language?: 'ar' | 'en';
  /** Short lines under the title - period covered, who produced it, when. */
  meta?: string[];
}) {
  const isRTL = language === 'ar';

  return (
    <header className="hidden print:block">
      <div className="flex items-start justify-between border-b-2 border-[#F29200] pb-3">
        <div className="flex items-center gap-3">
          <SaudiCableMark size={44} />
          <div className="leading-tight">
            <p className="text-base font-bold text-black">
              {isRTL ? 'شركة الكابلات السعودية' : 'Saudi Cable Company'}
            </p>
            <p className="text-[11px] text-neutral-600">
              {isRTL ? 'إدارة الجودة - المراجعة الداخلية' : 'Quality Management - Internal Audit'}
            </p>
          </div>
        </div>
        <div className="text-end leading-tight">
          <p className="text-sm font-bold text-black">{isRTL ? titleAr : titleEn}</p>
          {meta?.map(line => (
            <p key={line} className="text-[11px] text-neutral-600">
              {line}
            </p>
          ))}
        </div>
      </div>
    </header>
  );
}

export function ReportLetterheadFooter({ language = 'ar' }: { language?: 'ar' | 'en' }) {
  const isRTL = language === 'ar';

  return (
    <footer className="hidden border-t border-neutral-300 pt-2 text-[9px] leading-snug text-neutral-600 print:block">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p>{isRTL ? COMPANY.crAr : COMPANY.crEn}</p>
          <p>{isRTL ? COMPANY.capitalAr : COMPANY.capitalEn}</p>
        </div>
        <div>
          <p>{isRTL ? COMPANY.officeAr : COMPANY.officeEn}</p>
          <p dir="ltr">
            T {COMPANY.phone} · F {COMPANY.fax} · {COMPANY.toll}
          </p>
        </div>
        <div className="text-end">
          <p>{COMPANY.certs}</p>
          <p dir="ltr">{COMPANY.web}</p>
        </div>
      </div>
    </footer>
  );
}

/** The same registration block, as CSV rows, so an exported file carries its own provenance. */
export const letterheadCsvRows = (titleAr: string, generatedBy: string, at: string): string[][] => [
  ['شركة الكابلات السعودية - Saudi Cable Company'],
  ['إدارة الجودة - المراجعة الداخلية'],
  [titleAr],
  [`أُصدر بواسطة: ${generatedBy}`, `التاريخ: ${at}`],
  [COMPANY.crAr, COMPANY.capitalAr],
  [COMPANY.certs, COMPANY.web],
  [],
];
