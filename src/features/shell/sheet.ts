/**
 * Layout overrides that turn a side drawer into a bottom sheet below Tailwind's
 * `sm` breakpoint (640px). Shared by the Tuning, Library and Audio panels.
 *
 * On a phone the sheet is full width, sits above the 56px music dock, is at
 * most 75% of the screen tall (so the document stays visible above it), and
 * scrolls inside. From `sm` up none of these apply and the panel is unchanged.
 */
export const SHEET_LAYOUT =
  'max-sm:bottom-14 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:w-auto max-sm:max-h-[75dvh] max-sm:rounded-t-md max-sm:border-x-0 max-sm:border-t';
