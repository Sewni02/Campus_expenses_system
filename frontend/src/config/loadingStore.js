// Tiny global store that counts how many API requests are in flight.
// axiosConfig.js calls startRequest()/endRequest(); <GlobalLoader /> reads it.
// (Kept free of React so axios can use it outside any component.)

let state = { pending: 0, writes: 0 };
const listeners = new Set();

const setState = (next) => {
  state = next; // always a NEW object so useSyncExternalStore sees the change
  listeners.forEach((l) => l());
};

// Anything except GET/HEAD/OPTIONS changes data (save, upload, delete...).
const isWrite = (method) => !['get', 'head', 'options'].includes(String(method || 'get').toLowerCase());

export const startRequest = (method) =>
  setState({
    pending: state.pending + 1,
    writes: state.writes + (isWrite(method) ? 1 : 0),
  });

export const endRequest = (method) =>
  setState({
    pending: Math.max(0, state.pending - 1),
    writes: Math.max(0, state.writes - (isWrite(method) ? 1 : 0)),
  });

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = () => state;