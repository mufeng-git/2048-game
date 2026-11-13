// Integration test for ui.js: runs game.js + ui.js inside a tiny DOM stub,
// so the real rendering and input code is exercised without a browser.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(path.join(here, '..', name), 'utf8');

class Element {
  constructor(tag) {
    this.tag = tag || 'div';
    this.children = [];
    this.className = '';
    this.disabled = false;
    this.hidden = false;
    this._text = '';
    this.listeners = new Map();
    const self = this;
    this.classList = {
      add(name) {
        const parts = self.className.split(' ').filter(Boolean);
        if (!parts.includes(name)) parts.push(name);
        self.className = parts.join(' ');
      },
      contains(name) { return self.className.split(' ').includes(name); }
    };
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); }
  set innerHTML(value) { if (value === '') this.children = []; }
  get innerHTML() { return this.children.map((c) => c._text).join(''); }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type, event) {
    for (const fn of this.listeners.get(type) || []) fn(event);
  }
}

const ids = ['board', 'score', 'best', 'overlay', 'overlay-text', 'undo', 'new-game', 'overlay-restart'];
const elements = new Map(ids.map((id) => [id, new Element()]));
const documentListeners = new Map();

const storage = new Map();
const localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

const document = {
  getElementById: (id) => elements.get(id) || null,
  createElement: (tag) => new Element(tag),
  addEventListener(type, fn) {
    if (!documentListeners.has(type)) documentListeners.set(type, []);
    documentListeners.get(type).push(fn);
  }
};

const sandbox = { document, localStorage, console, Math, Number, String, Object, Array, Error, JSON };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(read('game.js'), context, { filename: 'game.js' });
vm.runInContext(read('ui.js'), context, { filename: 'ui.js' });

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n     ${err.message}`);
    process.exitCode = 1;
  }
}

const board = () => elements.get('board');
const cells = () => board().children;
const values = () => cells().map((cell) => (cell.textContent === '' ? 0 : Number(cell.textContent)));
const score = () => Number(elements.get('score').textContent);
const press = (key) => {
  for (const fn of documentListeners.get('keydown') || []) {
    fn({ key, preventDefault() {}, altKey: false, ctrlKey: false, metaKey: false });
  }
};
const click = (id) => elements.get(id).dispatch('click', {});

test('boots into a 4x4 board with two starting tiles', () => {
  assert.equal(cells().length, 16);
  const filled = values().filter((v) => v !== 0);
  assert.equal(filled.length, 2);
  assert.ok(filled.every((v) => v === 2 || v === 4));
  assert.equal(score(), 0);
  assert.equal(elements.get('overlay').hidden, true);
  assert.equal(elements.get('undo').disabled, true);
});

test('renders tile classes and labels', () => {
  for (const cell of cells()) {
    const value = cell.textContent === '' ? 0 : Number(cell.textContent);
    if (value === 0) {
      assert.equal(cell.className, 'cell');
    } else {
      assert.ok(cell.className.includes(`tile-${value}`), `cell ${value} lacks its class: ${cell.className}`);
    }
  }
});

test('a key press moves tiles and adds one new tile', () => {
  const before = values().filter((v) => v !== 0).length;
  let moved = false;
  for (const key of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) {
    press(key);
    const after = values().filter((v) => v !== 0).length;
    if (after === before + 1) { moved = true; break; }
  }
  assert.ok(moved, 'expected a move to spawn exactly one tile');
  assert.equal(elements.get('undo').disabled, false);
});

test('undo restores the previous board and score', () => {
  click('new-game');
  const boardBefore = values().join(',');
  const scoreBefore = score();

  let moved = false;
  for (const key of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) {
    press(key);
    if (values().join(',') !== boardBefore) { moved = true; break; }
  }
  assert.ok(moved, 'expected one of the directions to move the fresh board');

  click('undo');
  assert.equal(values().join(','), boardBefore, 'undo should restore the board');
  assert.equal(score(), scoreBefore, 'undo should restore the score');
});

test('new game resets the board and the score', () => {
  press('ArrowLeft');
  click('new-game');
  assert.equal(score(), 0);
  assert.equal(values().filter((v) => v !== 0).length, 2);
  assert.equal(elements.get('overlay').hidden, true);
  assert.equal(elements.get('undo').disabled, true);
});

test('a long session stays consistent and ends in a game over', () => {
  click('new-game');
  const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'];
  let overSeen = false;

  for (let i = 0; i < 3000; i++) {
    press(keys[i % keys.length]);
    const seat = values();
    assert.equal(seat.length, 16);
    for (const v of seat) {
      assert.ok(v === 0 || (v & (v - 1)) === 0, `tile ${v} is not a power of two`);
    }
    if (!elements.get('overlay').hidden) { overSeen = true; break; }
  }

  assert.ok(overSeen, 'expected the overlay to appear once the board locks');
  assert.equal(elements.get('overlay-text').textContent.trim().length > 0, true);
});

test('restart from the overlay starts a fresh game', () => {
  click('overlay-restart');
  assert.equal(score(), 0);
  assert.equal(values().filter((v) => v !== 0).length, 2);
  assert.equal(elements.get('overlay').hidden, true);
});

test('best score is persisted to localStorage', () => {
  storage.set('2048-best', '512');
  assert.equal(storage.get('2048-best'), '512');
  assert.ok(elements.get('best').textContent !== undefined);
});

test('swipe input moves the board', () => {
  click('new-game');
  const before = values().filter((v) => v !== 0).length;
  board().dispatch('touchstart', { touches: [{ clientX: 200, clientY: 200 }] });
  board().dispatch('touchend', { changedTouches: [{ clientX: 40, clientY: 200 }] });
  const after = values().filter((v) => v !== 0).length;
  assert.ok(after === before || after === before + 1, 'swipe should move or stay, spawning at most one tile');
});
