/**
 * Converts an underscore-delimited status string into a human-readable label.
 * e.g. "NOT_INTERESTED" → "Not Interested", "VISIT_BOOKED" → "Visit Booked"
 *
 * The raw status value is preserved for API calls, comparisons, and internal logic.
 * This function is only used at the presentation layer.
 */
export function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}