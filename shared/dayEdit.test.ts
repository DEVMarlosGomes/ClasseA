import { describe, expect, it } from 'vitest';
import { addExtraOpening, blockRanges, blockWholeDay, cellsToRanges, normalizeBlocks, releaseRanges, releaseWholeDay } from './dayEdit';

describe('day editing', () => {
  it('turns selected cells into compact ranges', () => {
    expect(cellsToRanges(['09:00', '09:30', '10:00', '14:00'], 30)).toEqual([
      { start: '09:00', end: '10:30' },
      { start: '14:00', end: '14:30' },
    ]);
    expect(cellsToRanges(['23:30'], 30)).toEqual([{ start: '23:30', end: '24:00' }]);
  });

  it('merges adjacent blocks with the same reason', () => {
    const d = blockRanges(null, [{ start: '09:00', end: '09:30' }], 'Almoço');
    const d2 = blockRanges(d, [{ start: '09:30', end: '10:00' }], 'Almoço');
    expect(d2.blocks).toEqual([{ start: '09:00', end: '10:00', reason: 'Almoço' }]);
  });

  it('keeps different reasons apart and lets the newest win on overlap', () => {
    const d = blockRanges(null, [{ start: '09:00', end: '11:00' }], 'Curso');
    const d2 = blockRanges(d, [{ start: '10:00', end: '12:00' }], 'Pessoal');
    expect(d2.blocks).toEqual([
      { start: '09:00', end: '10:00', reason: 'Curso' },
      { start: '10:00', end: '12:00', reason: 'Pessoal' },
    ]);
  });

  it('releases part of a block by splitting it', () => {
    const d = blockRanges(null, [{ start: '09:00', end: '12:00' }], null);
    expect(releaseRanges(d, [{ start: '10:00', end: '10:30' }]).blocks).toEqual([
      { start: '09:00', end: '10:00', reason: null },
      { start: '10:30', end: '12:00', reason: null },
    ]);
  });

  it('blocks and releases a whole day', () => {
    expect(blockWholeDay(null, 'Folga').blocks).toEqual([{ start: '00:00', end: '24:00', reason: 'Folga' }]);
    expect(releaseWholeDay({ status: 'closed', blocks: [{ start: '00:00', end: '24:00' }], extraOpenings: [] })).toEqual({
      status: 'open',
      blocks: [],
      extraOpenings: [],
    });
  });

  it('opens extra hours and clears blocks inside them', () => {
    const d = blockWholeDay(null, 'Folga');
    const e = addExtraOpening(d, { start: '10:00', end: '14:00' });
    expect(e.extraOpenings).toEqual([{ start: '10:00', end: '14:00' }]);
    expect(e.blocks).toEqual([
      { start: '00:00', end: '10:00', reason: 'Folga' },
      { start: '14:00', end: '24:00', reason: 'Folga' },
    ]);
  });

  it('normalises unsorted input', () => {
    expect(normalizeBlocks([{ start: '14:00', end: '15:00' }, { start: '09:00', end: '10:00' }]).map((b) => b.start)).toEqual(['09:00', '14:00']);
  });
});
