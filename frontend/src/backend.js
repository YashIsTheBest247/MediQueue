const listeners = new Set();
let pending = 0;
let visible = false;
let timer = null;

function emit() {
  for (const fn of listeners) fn(visible);
}

export function subscribeWake(fn) {
  listeners.add(fn);
  fn(visible);
  return () => listeners.delete(fn);
}

export async function withWake(thunk, delay = 2200) {
  pending += 1;
  if (!timer && !visible) {
    timer = setTimeout(() => {
      timer = null;
      visible = true;
      emit();
    }, delay);
  }
  try {
    return await thunk();
  } finally {
    pending -= 1;
    if (pending <= 0) {
      pending = 0;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (visible) {
        visible = false;
        emit();
      }
    }
  }
}

export function wakeFetch(url, opts) {
  return withWake(() => fetch(url, opts));
}
