import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Command } from '../../app/commands';
import { CommandPalette } from './CommandPalette';

function makeCommands() {
  const bionic = vi.fn();
  const theme = vi.fn();
  const commands: Command[] = [
    { id: 'bionic', title: 'Toggle bionic reading', group: 'View', hotkey: 'mod+b', run: bionic },
    { id: 'theme', title: 'Switch theme', group: 'View', run: theme },
  ];
  return { commands, bionic, theme };
}

describe('CommandPalette', () => {
  it('renders nothing while closed', () => {
    const { commands } = makeCommands();
    render(<CommandPalette open={false} onOpenChange={() => {}} commands={commands} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a dialog listing the commands when open', () => {
    const { commands } = makeCommands();
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Toggle bionic reading')).toBeInTheDocument();
    expect(screen.getByText('Switch theme')).toBeInTheDocument();
  });

  it('filters as you type', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} />);
    await user.type(screen.getByRole('combobox'), 'bion');
    expect(screen.getByText('Toggle bionic reading')).toBeInTheDocument();
    expect(screen.queryByText('Switch theme')).not.toBeInTheDocument();
  });

  it('runs the selected command on Enter and closes', async () => {
    const user = userEvent.setup();
    const { commands, bionic, theme } = makeCommands();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} commands={commands} />);
    await user.type(screen.getByRole('combobox'), 'bion');
    await user.keyboard('{Enter}');
    expect(bionic).toHaveBeenCalledTimes(1);
    expect(theme).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} commands={commands} />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('appends dynamic commands for the current query', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const run = vi.fn();
    const dynamic = (q: string): Command[] =>
      /^\d+$/.test(q) ? [{ id: 'p', title: `Go to page ${q}`, group: 'Document', run }] : [];
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} dynamic={dynamic} />);
    expect(screen.queryByText(/Go to page/)).not.toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), '12');
    expect(screen.getByText('Go to page 12')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('CommandPalette: search results', () => {
  const find = (id: string, title: string, extra: Partial<Command> = {}): Command => ({ id, title, group: 'Find', fixed: true, run: vi.fn(), ...extra });
  const headings = () => [...document.body.querySelectorAll('[cmdk-group-heading]')].map((el) => el.textContent);

  it('lists the Find group before every other group', () => {
    const { commands } = makeCommands();
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} dynamic={() => [find('a', 'First hit')]} />);
    expect(headings()).toEqual(['Find', 'View']);
  });

  it('keeps fixed rows visible and in the order given whatever is typed, while ordinary commands still filter', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const dynamic = () => [find('a', 'Zebra row'), find('b', 'Apple row'), find('c', 'Mango row')];
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} dynamic={dynamic} />);
    await user.type(screen.getByRole('combobox'), 'bion');
    expect([...document.body.querySelectorAll('[cmdk-item]')].map((el) => el.querySelector('span')?.textContent)).toEqual(['Zebra row', 'Apple row', 'Mango row', 'Toggle bionic reading']);
    expect(screen.queryByText('Switch theme')).not.toBeInTheDocument();
  });

  it('shows a hint on the right of a row', () => {
    const { commands } = makeCommands();
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} dynamic={() => [find('a', 'A hit', { hint: 'p. 12' })]} />);
    expect(screen.getByText('p. 12')).toBeInTheDocument();
  });

  it('runs a chosen hit and closes', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const run = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} commands={commands} dynamic={() => [find('a', 'A hit', { run })]} />);
    await user.type(screen.getByRole('combobox'), 'zz');
    await user.keyboard('{Enter}');
    expect(run).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not run or close for a disabled row, and Enter goes to the first row that can be chosen', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const status = find('s', 'Preparing search…', { disabled: true });
    const hit = find('h', 'A hit');
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} commands={commands} dynamic={() => [status, hit]} />);
    await user.click(screen.getByText('Preparing search…'));
    expect(status.run).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.type(screen.getByRole('combobox'), 'zz');
    await user.keyboard('{Enter}');
    expect(hit.run).toHaveBeenCalledTimes(1);
    expect(status.run).not.toHaveBeenCalled();
  });

  it('does not say "No matching command." while a status row is showing', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const { rerender } = render(<CommandPalette open onOpenChange={() => {}} commands={commands} dynamic={() => [find('s', 'No matches for "zz".', { disabled: true })]} />);
    await user.type(screen.getByRole('combobox'), 'zz');
    expect(screen.queryByText('No matching command.')).not.toBeInTheDocument();
    rerender(<CommandPalette open onOpenChange={() => {}} commands={commands} dynamic={() => []} />);
    expect(screen.getByText('No matching command.')).toBeInTheDocument();
  });

  it('reports what is typed, and an empty query once it closes', async () => {
    const user = userEvent.setup();
    const { commands } = makeCommands();
    const onQueryChange = vi.fn();
    const { rerender } = render(<CommandPalette open onOpenChange={() => {}} commands={commands} onQueryChange={onQueryChange} />);
    await user.type(screen.getByRole('combobox'), 'ab');
    expect(onQueryChange.mock.calls.map((call) => call[0])).toEqual(['a', 'ab']);
    rerender(<CommandPalette open={false} onOpenChange={() => {}} commands={commands} onQueryChange={onQueryChange} />);
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  it('uses the placeholder it is given', () => {
    const { commands } = makeCommands();
    render(<CommandPalette open onOpenChange={() => {}} commands={commands} placeholder="Find a word" />);
    expect(screen.getByPlaceholderText('Find a word')).toBeInTheDocument();
  });
});
