import { describe, expect, it } from 'vitest';
import { ConversationMaps } from './conversation-maps';

describe('ConversationMaps', () => {
  it('keeps one map per conversation', () => {
    const maps = new ConversationMaps();
    expect(maps.get('a')).toBe(maps.get('a'));
    expect(maps.get('a')).not.toBe(maps.get('b'));
  });

  it('hands the new-chat map to the first conversation id', () => {
    const maps = new ConversationMaps();
    const draft = maps.get(null);
    draft.getOrCreate('EMAIL', 'a@b.co');
    const chat = maps.get('c-123');
    expect(chat).toBe(draft);
    expect(chat.getOrCreate('EMAIL', 'c@d.co')).toBe('[EMAIL_2]');
  });

  it('starts a fresh map for the next new chat', () => {
    const maps = new ConversationMaps();
    const first = maps.get(null);
    maps.get('c-1');
    expect(maps.get(null)).not.toBe(first);
  });
});
