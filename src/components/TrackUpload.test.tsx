import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as tracks from '../lib/tracks';
import type { TrackRecord } from '../types';
import { TrackUpload } from './TrackUpload';

vi.mock('../lib/db', () => ({ db: {} }));
vi.mock('../lib/tracks');

const lib = vi.mocked(tracks);
const record = (id: string): TrackRecord => ({ id, title: id, artist: '', language: null, duration: 0, addedAt: 1 });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TrackUpload', () => {
  it('limits the picker to mp3 and aac', () => {
    render(<TrackUpload onAdded={() => {}} />);
    expect((screen.getByLabelText('Upload tracks') as HTMLInputElement).accept).toBe('.mp3,.aac');
  });

  it('stores a chosen file and reports it', async () => {
    const onAdded = vi.fn();
    lib.addUploadedTrack.mockResolvedValue(record('song'));
    render(<TrackUpload onAdded={onAdded} readDuration={async () => 200} />);
    const file = new File(['x'], 'song.mp3');
    fireEvent.change(screen.getByLabelText('Upload tracks'), { target: { files: [file] } });
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(record('song')));
    expect(lib.addUploadedTrack).toHaveBeenCalledWith(expect.anything(), file, { duration: 200 });
  });

  it('shows why an upload was refused', async () => {
    lib.addUploadedTrack.mockRejectedValue(new Error('Only .mp3 and .aac files can be added.'));
    render(<TrackUpload onAdded={() => {}} readDuration={async () => 0} />);
    fireEvent.change(screen.getByLabelText('Upload tracks'), { target: { files: [new File(['x'], 'a.wav')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Only .mp3 and .aac files can be added.');
  });

  it('adds a stream URL', async () => {
    const onAdded = vi.fn();
    lib.addStreamTrack.mockResolvedValue(record('radio'));
    render(<TrackUpload onAdded={onAdded} />);
    fireEvent.change(screen.getByLabelText('Stream URL'), { target: { value: 'https://radio.example/live' } });
    fireEvent.change(screen.getByLabelText('Stream name'), { target: { value: 'Night Radio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add stream' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(record('radio')));
    expect(lib.addStreamTrack).toHaveBeenCalledWith(expect.anything(), 'https://radio.example/live', { title: 'Night Radio' });
  });

  it('refuses an invalid URL without calling anything', async () => {
    render(<TrackUpload onAdded={() => {}} />);
    fireEvent.change(screen.getByLabelText('Stream URL'), { target: { value: 'http://radio.example/live' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add stream' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stream URLs must start with https://');
    expect(lib.addStreamTrack).not.toHaveBeenCalled();
  });
});
