// The one definition of a qualified candidate, shared by every tab and the settings API.

// Categories (set by the n8n AI category matcher) that are not a skilled trade.
// Editable in the Marketing settings; this is the starting list.
export const DEFAULT_NON_TRADE_CATEGORIES = [
  'Other', 'Labourer', 'skilled labourer',
  'Hospitality', 'Chef', 'Cleaner', 'Administration', 'Retail assistant', 'Call Center', 'Security',
  'Warehousing', 'Storeperson', 'Pick Packing', 'Courier', 'Logistics',
  'Community Worker', 'Caregiver', 'Nurse', 'Emergency Services', 'Tourism',
  'Sales Rep', 'Marketing', 'HR', 'IT',
  'Farmer', 'Farm hand / Manager',
  'Trade', 'Trades',
  'Building Apprentice', 'Electrician Apprentice', 'Plumbing Apprentice',
];

export interface QualifiableCandidate {
  'NZ Citizenship Status'?: string;
  Category?: string;
}

// Qualified candidate = NZ Citizen whose Category is a skilled trade. Long Category
// values are AI explanations rather than a category, so they count as unclassified.
export function candidateQualifier(nonTradeCategories: string[]) {
  const nonTrade = new Set(nonTradeCategories.map(c => c.trim().toLowerCase()));
  return (f: QualifiableCandidate) => {
    const category = f.Category?.trim() ?? '';
    return (
      f['NZ Citizenship Status'] === 'NZ Citizen' &&
      category.length > 0 && category.length <= 60 &&
      !nonTrade.has(category.toLowerCase())
    );
  };
}
