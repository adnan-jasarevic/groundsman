import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import {
  backupFileName,
  BackupError,
  lastBackupText,
  makeBackup,
  parseBackup,
  placeRestored,
} from './backup';

const mine = { ...FICTIONAL_SAVE, sample: undefined };
const plans = { formationId: '433', tiers: 3, plans: {} };

describe('backup files', () => {
  it('round-trips saves and their plans', () => {
    const text = JSON.stringify(makeBackup([{ save: mine, plans }]));
    expect(parseBackup(text)).toEqual([{ save: mine, plans }]);
  });

  it('turns away files that are not Groundsman backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow("isn't a Groundsman backup");
    expect(() => parseBackup(JSON.stringify({ ...makeBackup([]), version: 2 }))).toThrow(
      'newer Groundsman',
    );
    expect(() => parseBackup(JSON.stringify(makeBackup([])))).toThrow('no saves');
  });

  it('refuses a backup with a damaged save rather than restoring part of it', () => {
    const broken = { ...mine, players: [{ id: 'x' }] };
    const text = JSON.stringify(
      makeBackup([
        { save: mine, plans },
        { save: broken as never, plans },
      ]),
    );
    expect(() => parseBackup(text)).toThrow('Save 2 in this backup is damaged');
  });

  it('names a save that has none after its club', () => {
    const unnamed: Partial<typeof mine> = { ...mine };
    delete unnamed.name;
    const [entry] = parseBackup(
      JSON.stringify(makeBackup([{ save: unnamed as never, plans: null }])),
    );
    expect(entry.save.name).toBe('Harrowgate Town');
  });

  it('restores a save that is already here as a copy, never over it', () => {
    const here = [{ id: mine.id, name: mine.name }];
    const twice = placeRestored(
      [
        { save: mine, plans },
        { save: mine, plans },
      ],
      here,
    );
    expect(twice.map((e) => e.save.name)).toEqual([
      'Harrowgate Town (restored)',
      'Harrowgate Town (restored 2)',
    ]);
    expect(new Set([mine.id, ...twice.map((e) => e.save.id)]).size).toBe(3);
  });

  it('keeps the id and name of a save that is not here', () => {
    const [entry] = placeRestored([{ save: mine, plans }], []);
    expect(entry.save.id).toBe(mine.id);
    expect(entry.save.name).toBe(mine.name);
  });

  it('dates the file name and names a single save after it', () => {
    const now = new Date(2026, 10, 25);
    expect(backupFileName(null, now)).toBe('groundsman-backup-2026-11-25.json');
    expect(backupFileName('Kärpät 2nd go!', now)).toBe('groundsman-karpat-2nd-go-2026-11-25.json');
  });

  it('says how long ago the last backup was', () => {
    const now = new Date(2026, 10, 25, 18);
    expect(lastBackupText(null, now)).toBe('Never backed up');
    expect(lastBackupText('2026-11-25', now)).toBe('Backed up today');
    expect(lastBackupText('2026-11-24', now)).toBe('Last backup yesterday');
    expect(lastBackupText('2026-11-13', now)).toBe('Last backup 12 days ago');
  });
});
