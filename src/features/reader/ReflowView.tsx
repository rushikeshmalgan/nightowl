import type { ReflowDoc } from '../pdf/reflowText';
import { TextView } from './TextView';

/** Where a page's divider sits below the scroll container's top edge: clear of the 32px status line. */
export const REFLOW_TOP_MARGIN = 40;

export interface ReflowViewProps {
  doc: ReflowDoc;
  bionic: boolean;
  dyslexic: boolean;
  fontSize: number;
  lineHeight: number;
}

/**
 * A PDF's text as one readable column. Each page's paragraphs go through the
 * normal text view, so the reading settings apply, under a "Page N" divider
 * that is not part of the text (selection and read-aloud skip it).
 */
export function ReflowView({ doc, bionic, dyslexic, fontSize, lineHeight }: ReflowViewProps) {
  return (
    <>
      {doc.pages.map(({ page, paragraphs }) => (
        <section key={page} data-page={page} aria-label={`Page ${page}`} className="mb-12">
          <div role="separator" aria-label={`Page ${page}`} className="mx-auto mb-4 flex max-w-[72ch] items-center gap-3 text-xs text-muted">
            <span aria-hidden="true">Page {page}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
          </div>
          {paragraphs.length > 0 ? (
            <TextView text={paragraphs.join('\n\n')} mono={false} bionic={bionic} dyslexic={dyslexic} fontSize={fontSize} lineHeight={lineHeight} />
          ) : (
            <p className="mx-auto max-w-[72ch] text-sm text-muted">No text on this page.</p>
          )}
        </section>
      ))}
    </>
  );
}

function sectionTops(scroller: HTMLElement): Array<{ page: number; top: number }> {
  const origin = scroller.getBoundingClientRect().top;
  return [...scroller.querySelectorAll<HTMLElement>('section[data-page]')].map((section) => ({
    page: Number(section.dataset.page),
    top: section.getBoundingClientRect().top - origin,
  }));
}

/**
 * The page whose section is under the top edge of the scroll container. At the very end it is the last
 * page, since a short last page cannot always be scrolled up until its divider reaches the top.
 */
export function reflowPageAt(scroller: HTMLElement): number {
  const tops = sectionTops(scroller);
  const atEnd = scroller.clientHeight > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
  if (atEnd && tops.length > 0) return tops[tops.length - 1].page;
  let current = 1;
  for (const { page, top } of tops) {
    if (top <= REFLOW_TOP_MARGIN) current = page;
    else break;
  }
  return current;
}

/** Scrolls so the given page's divider sits just below the status line. */
export function scrollToReflowPage(scroller: HTMLElement, page: number): void {
  const target = sectionTops(scroller).find((section) => section.page === page);
  if (target) scroller.scrollTop += target.top - REFLOW_TOP_MARGIN;
}
