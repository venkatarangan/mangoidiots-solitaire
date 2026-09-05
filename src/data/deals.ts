import catalog from './catalog.json' with { type: 'json' };
import { newBoard } from '../game/engine.ts';

export type Difficulty = 'Easy' | 'Medium' | 'Difficult';
export interface Deal {
  id: string;
  difficulty: Difficulty;
  deck: number[];
  seed: number;
  verification: string;
  searchNodes: number;
  metrics: {
    buriedLowCards: number;
    initialLegalChoices: number;
    tableauMoves: number;
    wastePlacements: number;
    recycles: number;
    draws: number;
    reveals: number;
    unsafePromotions: number;
    solutionLength: number;
    rating: number;
  };
}

/** Only the small catalog is bundled; the offline solver and witnesses are not. */
export const deals: Deal[] = catalog.map(value => {
  if (!['Easy', 'Medium', 'Difficult'].includes(value.difficulty)) throw new Error('Invalid catalog tier.');
  newBoard(value.deck);
  return { ...value, difficulty: value.difficulty as Difficulty, deck: [...value.deck] };
});
if (deals.length !== 90 || new Set(deals.map(d => d.id)).size !== 90 ||
    ['Easy', 'Medium', 'Difficult'].some(t => deals.filter(d => d.difficulty === t).length !== 30)) {
  throw new Error('Invalid launch catalog.');
}
