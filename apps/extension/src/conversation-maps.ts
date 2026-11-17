import { PlaceholderMap } from '@fishnet/pii-core';

/**
 * One placeholder map per conversation, so [EMAIL_1] always means the same
 * value inside a chat.
 *
 * A new chat has no id until its first message is sent. Its map is held as
 * "pending" and adopted by the first conversation id that appears, so
 * numbering continues instead of restarting at 1.
 *
 * In memory only for now; v2 moves this to storage.session.
 */
export class ConversationMaps {
  private maps = new Map<string, PlaceholderMap>();
  private pending: PlaceholderMap | null = null;

  get(conversationId: string | null): PlaceholderMap {
    if (conversationId === null) {
      this.pending ??= new PlaceholderMap();
      return this.pending;
    }
    let map = this.maps.get(conversationId);
    if (!map) {
      map = this.pending ?? new PlaceholderMap();
      this.pending = null;
      this.maps.set(conversationId, map);
    }
    return map;
  }
}
