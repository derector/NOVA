import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UsersService } from '../src/users/users.service';
import { ChatsService } from '../src/chats/chats.service';
import type { DatabaseService } from '../src/database/database.module';

test('public username search never selects or returns account email', async () => {
  let sql = '';
  const db = {
    query: async (statement: string) => {
      sql = statement;
      return { rows: [{ id: 'user-2', username: 'river_2', display_name: 'River' }], rowCount: 1 };
    },
  } as unknown as DatabaseService;

  const result = await new UsersService(db).search('river', 'user-1');
  assert.doesNotMatch(sql, /\bemail\b/i);
  assert.deepEqual(result, [{ id: 'user-2', username: 'river_2', displayName: 'River' }]);
  assert.equal(Object.hasOwn(result[0], 'email'), false);
});

test('chat list participant DTO never selects or returns account email', async () => {
  let sql = '';
  const db = {
    query: async (statement: string) => {
      sql = statement;
      return {
        rows: [{ id: 'chat-1', peer_id: 'user-2', username: 'river_2', display_name: 'River', updated_at: new Date('2026-01-01T00:00:00Z') }],
        rowCount: 1,
      };
    },
  } as unknown as DatabaseService;

  const result = await new ChatsService(db).listChats('user-1');
  assert.doesNotMatch(sql, /\bemail\b/i);
  assert.deepEqual(result[0].participant, { id: 'user-2', username: 'river_2', displayName: 'River' });
  assert.equal(Object.hasOwn(result[0].participant, 'email'), false);
});
