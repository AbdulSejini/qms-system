// Audit checklist question bank.
//
// The QA department maintains one Word checklist per audit area. Those were
// extracted into src/data/question-bank.json and mapped onto the organisational
// structure in src/data/org-structure.json, so creating an audit for a section
// can start from the questions that section is actually audited against instead
// of a blank page.
//
// Matching is deliberately forgiving: Firestore departments and sections carry a
// `code`, but the records were created by hand and their codes may not line up
// with the workbook. So we match on code first, then fall back to comparing
// normalised names.

import bankData from '@/data/question-bank.json';
import orgData from '@/data/org-structure.json';

export interface BankQuestion {
  text: string;
  area: string;
  standard: string;
}

interface BankArea {
  area: string;
  sourceFile: string;
  standard: string;
  questionCount: number;
  questions: string[];
  sectionCodes: string[];
  departmentCodes: string[];
}

interface OrgSection {
  code: string;
  nameEn: string;
  nameAr: string;
  auditee: string;
  departmentHead?: string;
}

interface OrgDepartment {
  code: string;
  nameEn: string;
  nameAr: string;
  head?: string;
  sections: OrgSection[];
}

const areas = (bankData as { areas: BankArea[] }).areas;
const departments = (orgData as { departments: OrgDepartment[] }).departments;

// Strip punctuation, collapse whitespace, drop the separators the workbook uses
// between a parent area and its sub-area so "Production / Low Voltage" and
// "Production - Low voltage" compare equal.
const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[/\-_&,.()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sectionByCode = new Map<string, OrgSection>();
const sectionCodeByName = new Map<string, string>();
const departmentCodeByName = new Map<string, string>();

for (const department of departments) {
  departmentCodeByName.set(normalise(department.nameEn), department.code);
  departmentCodeByName.set(normalise(department.nameAr), department.code);
  for (const section of department.sections) {
    sectionByCode.set(section.code, section);
    sectionCodeByName.set(normalise(section.nameEn), section.code);
    sectionCodeByName.set(normalise(section.nameAr), section.code);
  }
}

/** Resolve a Firestore section to a question-bank section code. */
export const resolveSectionCode = (
  code?: string | null,
  nameEn?: string | null,
  nameAr?: string | null
): string | null => {
  if (code && sectionByCode.has(code)) return code;
  for (const name of [nameEn, nameAr]) {
    if (!name) continue;
    const match = sectionCodeByName.get(normalise(name));
    if (match) return match;
  }
  return null;
};

/** Resolve a Firestore department to a question-bank department code. */
export const resolveDepartmentCode = (
  code?: string | null,
  nameEn?: string | null,
  nameAr?: string | null
): string | null => {
  if (code && departments.some((d) => d.code === code)) return code;
  for (const name of [nameEn, nameAr]) {
    if (!name) continue;
    const match = departmentCodeByName.get(normalise(name));
    if (match) return match;
  }
  return null;
};

const toQuestions = (matching: BankArea[]): BankQuestion[] => {
  const seen = new Set<string>();
  const result: BankQuestion[] = [];
  for (const area of matching) {
    for (const text of area.questions) {
      const key = normalise(text);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ text, area: area.area, standard: area.standard });
    }
  }
  return result;
};

/** Questions the checklists define for one section. */
export const getQuestionsForSection = (sectionCode: string): BankQuestion[] =>
  toQuestions(areas.filter((a) => a.sectionCodes.includes(sectionCode)));

/**
 * Questions for a whole department - the union across its sections, deduplicated.
 * Used when an audit is scoped to a department without naming a section.
 */
export const getQuestionsForDepartment = (departmentCode: string): BankQuestion[] =>
  toQuestions(areas.filter((a) => a.departmentCodes.includes(departmentCode)));

/**
 * The main entry point for the audit form. Prefers the section's own checklist
 * and widens to the department only when no section was chosen, so an auditor
 * scoping a single section is not handed the whole division's questions.
 */
export const getSuggestedQuestions = (params: {
  departmentCode?: string | null;
  departmentNameEn?: string | null;
  departmentNameAr?: string | null;
  sectionCode?: string | null;
  sectionNameEn?: string | null;
  sectionNameAr?: string | null;
}): BankQuestion[] => {
  const sectionCode = resolveSectionCode(
    params.sectionCode,
    params.sectionNameEn,
    params.sectionNameAr
  );
  if (sectionCode) return getQuestionsForSection(sectionCode);

  const departmentCode = resolveDepartmentCode(
    params.departmentCode,
    params.departmentNameEn,
    params.departmentNameAr
  );
  if (departmentCode) return getQuestionsForDepartment(departmentCode);

  return [];
};

/** The auditee the workbook records for a section, for prefilling the form. */
export const getRecordedAuditee = (sectionCode: string): string =>
  sectionByCode.get(sectionCode)?.auditee ?? '';

export const questionBankSize = areas.reduce((sum, a) => sum + a.questionCount, 0);
export const questionBankAreaCount = areas.length;
