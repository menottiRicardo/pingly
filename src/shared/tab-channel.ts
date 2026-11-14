/** Messages between browser tabs of the same app. No-op where BroadcastChannel is missing. */
export interface TabChannel<M> {
  post(message: M): void;
  close(): void;
}

export function createTabChannel<M>(name: string, onMessage: (message: M) => void): TabChannel<M> {
  if (typeof BroadcastChannel === 'undefined') return { post() {}, close() {} };
  const channel = new BroadcastChannel(name);
  channel.onmessage = (event: MessageEvent<M>) => onMessage(event.data);
  return {
    post: (message) => {
      try {
        channel.postMessage(message);
      } catch {
        // Uncloneable payloads are simply not shared.
      }
    },
    close: () => channel.close(),
  };
}
