import { readFileSync, writeFileSync } from 'node:fs';
import type { EntityType } from '../packages/pii-core/src';

export interface GoldEntity {
  type: EntityType;
  start: number;
  end: number;
}

export interface Sample {
  id: string;
  text: string;
  entities: GoldEntity[];
  source: 'synthetic' | 'handlabeled' | 'negative';
  tags?: string[];
}

const MARK = /\{\{([A-Z_]+)\|([\s\S]*?)\}\}/g;

/** "Mail {{EMAIL|a@b.co}} now" -> text "Mail a@b.co now" with one EMAIL entity. */
export function parseMarked(marked: string): { text: string; entities: GoldEntity[] } {
  let text = '';
  let last = 0;
  const entities: GoldEntity[] = [];
  for (const m of marked.matchAll(MARK)) {
    text += marked.slice(last, m.index);
    const value = m[2] ?? '';
    entities.push({
      type: m[1] as EntityType,
      start: text.length,
      end: text.length + value.length,
    });
    text += value;
    last = m.index + m[0].length;
  }
  return { text: text + marked.slice(last), entities };
}

export function readJsonl(path: string): Sample[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Sample);
}

export function writeJsonl(path: string, samples: Sample[]): void {
  writeFileSync(path, `${samples.map((s) => JSON.stringify(s)).join('\n')}\n`);
}
