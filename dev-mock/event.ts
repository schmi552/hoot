const listeners = new Map<string, Set<(e: { payload: any }) => void>>();
export const emitLocal = (name: string, payload?: any) => listeners.get(name)?.forEach((f) => f({ payload }));
export const emit = async (name: string, payload?: any) => emitLocal(name, payload);
export const listen = async (name: string, f: (e: { payload: any }) => void) => {
  (listeners.get(name) ?? listeners.set(name, new Set()).get(name)!).add(f);
  return () => void listeners.get(name)!.delete(f);
};
