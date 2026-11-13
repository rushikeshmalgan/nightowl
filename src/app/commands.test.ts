import { buildCommands, formatHotkey, pageCommands } from './commands';

describe('pageCommands', () => {
  it('offers the page a whole number names', () => {
    const goTo = vi.fn();
    const commands = pageCommands('5', 10, goTo);
    expect(commands).toHaveLength(1);
    expect(commands[0].title).toBe('Go to page 5');
    commands[0].run();
    expect(goTo).toHaveBeenCalledWith(5);
  });

  it('accepts the first and last page', () => {
    expect(pageCommands('1', 10, () => {})).toHaveLength(1);
    expect(pageCommands('10', 10, () => {})).toHaveLength(1);
  });

  it('offers nothing outside the document or for non-numbers', () => {
    expect(pageCommands('0', 10, () => {})).toEqual([]);
    expect(pageCommands('11', 10, () => {})).toEqual([]);
    expect(pageCommands('abc', 10, () => {})).toEqual([]);
    expect(pageCommands('2.5', 10, () => {})).toEqual([]);
    expect(pageCommands('', 10, () => {})).toEqual([]);
  });

  it('offers nothing when no paged document is open', () => {
    expect(pageCommands('5', null, () => {})).toEqual([]);
  });
});

describe('buildCommands', () => {
  const ui = { set: vi.fn(), toggle: vi.fn(), reset: vi.fn() };

  it('adds an open command per document and a clear command when wired', () => {
    const openDocument = vi.fn();
    const requestClear = vi.fn();
    const commands = buildCommands({
      ui,
      tts: { supported: false, toggle: () => {} },
      documents: [{ id: 'a', name: 'Alpha.pdf' }],
      openDocument,
      requestClear,
    });
    commands.find((c) => c.title === 'Open Alpha.pdf')?.run();
    expect(openDocument).toHaveBeenCalledWith('a');
    commands.find((c) => c.title === 'Clear cache')?.run();
    expect(requestClear).toHaveBeenCalled();
  });

  it('leaves out read aloud when the browser cannot speak', () => {
    const commands = buildCommands({ ui, tts: { supported: false, toggle: () => {} } });
    expect(commands.some((c) => c.id === 'tts')).toBe(false);
  });

  it('leaves out the bionic and dyslexia commands when they are blocked', () => {
    const commands = buildCommands({ ui, tts: { supported: false, toggle: () => {} }, blocked: { bionic: true, dyslexic: true } });
    expect(commands.some((c) => c.id === 'bionic')).toBe(false);
    expect(commands.some((c) => c.id === 'dyslexic')).toBe(false);
  });

  it('blocks them independently', () => {
    const onlyBionic = buildCommands({ ui, tts: { supported: false, toggle: () => {} }, blocked: { bionic: true } });
    expect(onlyBionic.some((c) => c.id === 'bionic')).toBe(false);
    expect(onlyBionic.some((c) => c.id === 'dyslexic')).toBe(true);
  });

  it('keeps both commands when nothing is blocked', () => {
    const commands = buildCommands({ ui, tts: { supported: false, toggle: () => {} } });
    expect(commands.some((c) => c.id === 'bionic')).toBe(true);
    expect(commands.some((c) => c.id === 'dyslexic')).toBe(true);
  });

  it('toggles night pages', () => {
    const commands = buildCommands({ ui, tts: { supported: false, toggle: () => {} } });
    commands.find((c) => c.title === 'Toggle night pages')?.run();
    expect(ui.toggle).toHaveBeenCalledWith('nightPages');
  });
});

describe('formatHotkey', () => {
  it('spells out modifiers and arrows', () => {
    expect(formatHotkey('mod+k')).toBe('Ctrl K');
    expect(formatHotkey('mod+k', true)).toBe('⌘ K');
    expect(formatHotkey('ArrowLeft')).toBe('←');
  });
});
