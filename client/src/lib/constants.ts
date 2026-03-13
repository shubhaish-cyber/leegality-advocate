export const POST_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  posted: 'Posted',
  skipped: 'Skipped',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-navy-100 text-navy-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-100 text-amber-700',
  posted: 'bg-green-100 text-green-700',
  skipped: 'bg-red-100 text-red-600',
};
