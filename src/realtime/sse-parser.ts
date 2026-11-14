export interface SSEMessage {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Incremental parser for the text/event-stream format. Feed it chunks as
 * they arrive; it calls `onMessage` for each complete event.
 */
export function createSSEParser(onMessage: (message: SSEMessage) => void) {
  let buffer = '';
  let data: string[] = [];
  let event = '';
  let id: string | undefined;
  let retry: number | undefined;

  const dispatch = () => {
    if (data.length) onMessage({ event: event || 'message', data: data.join('\n'), id, retry });
    data = [];
    event = '';
    retry = undefined;
  };

  const line = (text: string) => {
    if (text === '') return dispatch();
    if (text.startsWith(':')) return;
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? '' : text.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
    else if (field === 'id' && !value.includes('\0')) id = value;
    else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? '';
      for (const l of lines) line(l);
    },
    end() {
      if (buffer) line(buffer);
      buffer = '';
      dispatch();
    },
  };
}
