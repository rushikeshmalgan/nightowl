import { Fragment, useMemo } from 'react';
import { bionicSplit } from '../lib/bionic';

export interface TextViewProps {
  text: string;
  mono: boolean;
  bionic: boolean;
  dyslexic: boolean;
  fontSize: number;
  lineHeight: number;
}

function fontClass(mono: boolean, dyslexic: boolean): string {
  if (dyslexic) return 'font-dyslexic';
  return mono ? 'font-mono' : 'font-serif';
}

export function TextView({ text, mono, bionic, dyslexic, fontSize, lineHeight }: TextViewProps) {
  // Split on whitespace runs but keep them, so spacing and line breaks survive.
  const tokens = useMemo(() => (bionic ? text.split(/(\s+)/) : []), [bionic, text]);

  return (
    <article
      className={`mx-auto max-w-[72ch] whitespace-pre-wrap break-words text-ink ${fontClass(mono, dyslexic)}`}
      style={{ fontSize: `${fontSize}px`, lineHeight }}
    >
      {bionic
        ? tokens.map((token, index) => {
            if (token === '' || /^\s+$/.test(token)) return <Fragment key={index}>{token}</Fragment>;
            const { head, tail } = bionicSplit(token);
            return (
              <Fragment key={index}>
                <strong className="font-semibold">{head}</strong>
                {tail}
              </Fragment>
            );
          })
        : text}
    </article>
  );
}
