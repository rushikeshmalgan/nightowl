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
