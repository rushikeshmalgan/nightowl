import { useEffect } from 'react';
import { useUi } from './ui';

const SHEETS = ['tuningOpen', 'libraryOpen', 'audioOpen'] as const;

/** Close every sheet except `keep`. */
function closeOthers(keep: (typeof SHEETS)[number]): void {
  const state = useUi.getState();
  for (const key of SHEETS) if (key !== keep && state[key]) state.set(key, false);
}

/**
 * On a narrow screen the Tuning, Library and Audio panels are bottom sheets in
 * the same spot, so only one may be open: opening one closes the others. On a
 * wide screen they are side drawers and may be open together.
 */
export function useExclusiveSheets(narrow: boolean): void {
  useEffect(() => {
    if (!narrow) return;

    // Panels that were open together on a wide screen collapse to one.
    const open = SHEETS.filter((key) => useUi.getState()[key]);
    if (open.length > 1) closeOthers(open[open.length - 1]);

    return useUi.subscribe((state, previous) => {
      const opened = SHEETS.filter((key) => state[key] && !previous[key]);
      if (opened.length > 0) closeOthers(opened[opened.length - 1]);
    });
  }, [narrow]);
}
