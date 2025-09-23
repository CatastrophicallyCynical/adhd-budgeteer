import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({
  onRequest: handler => handler,
}));

vi.mock('firebase-admin', () => {
  const admin = {
    initializeApp: vi.fn(),
    messaging: () => ({ sendEachForMulticast: vi.fn() }),
    firestore: () => ({ collection: () => ({ get: vi.fn() }) }),
  };
  return { default: admin };
});

const { makeSendToAll } = await import('../index.js');

function snapshotWithTokens(tokens) {
  return {
    forEach: cb => {
      tokens.forEach(token => {
        cb({
          get: field => (field === 'fcm_token' ? token : undefined),
        });
      });
    },
  };
}

describe('makeSendToAll', () => {
  it('returns reason when there are no tokens', async () => {
    const get = vi.fn(async () => ({
      forEach: () => {},
    }));
    const messaging = { sendEachForMulticast: vi.fn() };
    const firestore = { collection: () => ({ get }) };

    const sendToAll = makeSendToAll({ firestore, messaging });
    const result = await sendToAll('Title', 'Body');

    expect(result).toEqual({ ok: false, reason: 'no tokens' });
    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends notifications to all stored tokens', async () => {
    const tokens = ['token-a', '', 'token-b'];
    const get = vi.fn(async () => snapshotWithTokens(tokens));
    const messaging = {
      sendEachForMulticast: vi.fn(async () => ({ responses: [{}, {}, {}] })),
    };
    const firestore = { collection: () => ({ get }) };

    const sendToAll = makeSendToAll({ firestore, messaging });
    const result = await sendToAll('Weekly reset', 'Ping', { kind: 'weekly' });

    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token-a', 'token-b'],
      notification: { title: 'Weekly reset', body: 'Ping' },
      data: { kind: 'weekly' },
    });
    expect(result).toEqual({ ok: true, res: 3 });
  });

  it('defaults data payload to an empty object', async () => {
    const get = vi.fn(async () => snapshotWithTokens(['token']));
    const messaging = {
      sendEachForMulticast: vi.fn(async () => ({ responses: [{}] })),
    };
    const firestore = { collection: () => ({ get }) };

    const sendToAll = makeSendToAll({ firestore, messaging });
    await sendToAll('Daily', 'Hello');

    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token'],
      notification: { title: 'Daily', body: 'Hello' },
      data: {},
    });
  });

  it('returns failure details when messaging rejects', async () => {
    const get = vi.fn(async () => snapshotWithTokens(['token']));
    const messaging = {
      sendEachForMulticast: vi.fn(async () => {
        throw Object.assign(new Error('network down'), { code: 'unavailable' });
      }),
    };
    const firestore = { collection: () => ({ get }) };

    const sendToAll = makeSendToAll({ firestore, messaging });
    const result = await sendToAll('Ping', 'Hello');

    expect(result).toEqual({ ok: false, reason: 'network down' });
  });

  it('flags responses that include errors', async () => {
    const get = vi.fn(async () => snapshotWithTokens(['token']));
    const messaging = {
      sendEachForMulticast: vi.fn(async () => ({
        responses: [
          { success: true },
          { success: false, error: { message: 'invalid token' } },
        ],
      })),
    };
    const firestore = { collection: () => ({ get }) };

    const sendToAll = makeSendToAll({ firestore, messaging });
    const result = await sendToAll('Ping', 'Hello');

    expect(result).toEqual({ ok: false, reason: 'invalid token' });
  });
});
