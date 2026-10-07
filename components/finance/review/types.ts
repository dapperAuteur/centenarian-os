// components/finance/review/types.ts
// What the finance Review page hands its sections.

export type ReviewSectionKey = 'transfers' | 'payments' | 'matches' | 'uncategorized' | 'drafts';

/** What an action reports back: a success sentence, a failure sentence, or both (some items failed). */
export interface ActionOutcome {
  status?: string;
  error?: string;
}

/**
 * Runs one action for a section: marks the page busy, shows the outcome
 * (role=status / role=alert), reloads the review, and puts focus back on the
 * section's heading.
 */
export type RunAction = (section: ReviewSectionKey, work: () => Promise<ActionOutcome>) => Promise<void>;

/** An account for the "Paid from" / "Paid to" pickers. */
export interface PickerAccount {
  id: string;
  label: string;
  account_type: string;
  is_active: boolean;
}
