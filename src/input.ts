export type InputState = {
  keys: Set<string>;
  mouse: { x: number; y: number };
  fireRequested: boolean;
};

export function createInputState(): InputState {
  return { keys: new Set<string>(), mouse: { x: 640, y: 360 }, fireRequested: false };
}
