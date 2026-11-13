import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'game.js'), 'utf8');

const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const G = mod.exports;

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

const line = (...values) => { const a = values.slice(); while (a.length < 4) a.push(0); return a; };

test('compressLine moves tiles left without merging different values', () => {
  assert.deepEqual(G.compressLine(line(2, 0, 0, 4)).line, line(2, 4));
  assert.equal(G.compressLine(line(2, 0, 0, 4)).gained, 0);
});

test('compressLine merges a pair and scores its value', () => {
  assert.deepEqual(G.compressLine(line(2, 2, 0, 0)).line, line(4));
  assert.equal(G.compressLine(line(2, 2, 0, 0)).gained, 4);
});

test('compressLine merges each pair once, left to right', () => {
  assert.deepEqual(G.compressLine(line(2, 2, 2, 2)).line, line(4, 4));
  assert.equal(G.compressLine(line(2, 2, 2, 2)).gained, 8);
  assert.deepEqual(G.compressLine(line(4, 4, 8, 0)).line, line(8, 8));
  assert.deepEqual(G.compressLine(line(2, 2, 4, 4)).line, line(4, 8));
  assert.equal(G.compressLine(line(2, 2, 4, 4)).gained, 12);
});

test('compressLine does not chain a freshly merged tile', () => {
  const result = G.compressLine(line(4, 4, 4, 0));
  assert.deepEqual(result.line, line(8, 4));
  assert.equal(result.gained, 8);
});

test('compressLine handles gaps and full lines', () => {
  assert.deepEqual(G.compressLine(line(2, 0, 2, 2)).line, line(4, 2));
  assert.deepEqual(G.compressLine(line(0, 0, 0, 8)).line, line(8));
  assert.deepEqual(G.compressLine(line(1024, 1024, 0, 0)).line, line(2048));
  assert.deepEqual(G.compressLine(line(2, 4, 2, 4)).line, line(2, 4, 2, 4));
});

test('move left collapses rows toward index 0', () => {
  const grid = [
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [4, 0, 4, 0],
    [2, 4, 8, 16]
  ];
  const result = G.move(grid, 'left');
  assert.deepEqual(result.grid, [
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [8, 0, 0, 0],
    [2, 4, 8, 16]
  ]);
  assert.equal(result.gained, 12);
  assert.equal(result.moved, true);
});

test('move right collapses rows toward the last index', () => {
  const grid = [
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [0, 4, 0, 4],
    [0, 0, 0, 0]
  ];
  const result = G.move(grid, 'right');
  assert.deepEqual(result.grid, [
    [0, 0, 0, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 8],
    [0, 0, 0, 0]
  ]);
  assert.equal(result.gained, 12);
});

test('move up collapses columns toward row 0', () => {
  const grid = [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 8, 0, 0],
    [2, 0, 0, 0]
  ];
  const result = G.move(grid, 'up');
  assert.deepEqual(result.grid, [
    [4, 8, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);
  assert.equal(result.gained, 4);
});

test('move down collapses columns toward the last row', () => {
  const grid = [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 8, 0, 0],
    [2, 0, 0, 0]
  ];
  const result = G.move(grid, 'down');
  assert.deepEqual(result.grid, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [4, 8, 0, 0]
  ]);
  assert.equal(result.gained, 4);
});

test('move reports moved=false when nothing changes', () => {
  const grid = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  assert.equal(G.move(grid, 'left').moved, false);
  assert.equal(G.move(grid, 'right').moved, false);
  assert.equal(G.move(grid, 'up').moved, false);
  // A row sitting at the top does slide down.
  assert.equal(G.move(grid, 'down').moved, true);

  const withGap = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 2]
  ];
  assert.equal(G.move(withGap, 'left').moved, true);
  assert.equal(G.move(withGap, 'up').moved, true);
});

test('move does not mutate the input grid', () => {
  const grid = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const before = JSON.stringify(grid);
  G.move(grid, 'left');
  assert.equal(JSON.stringify(grid), before);
});

test('spawnTile only fills empty cells with 2 or 4', () => {
  const grid = G.createGrid();
  for (let i = 0; i < G.SIZE * G.SIZE; i++) {
    const spawned = G.spawnTile(grid);
    assert.ok(spawned, `expected a spawned tile at step ${i}`);
    assert.equal(grid[spawned.row][spawned.col], spawned.value);
    assert.ok([2, 4].includes(spawned.value));
  }
  assert.equal(G.emptyCells(grid).length, 0);
  assert.equal(G.spawnTile(grid), null, 'a full board must not spawn');
});

test('spawnTile honours the injected rng', () => {
  const grid = G.createGrid();
  const tile = G.spawnTile(grid, () => 0);
  assert.deepEqual({ row: tile.row, col: tile.col, value: tile.value }, { row: 0, col: 0, value: 2 });
});

test('newGame starts with two tiles and zero score', () => {
  const game = G.newGame();
  assert.equal(game.score, 0);
  const filled = game.grid.flat().filter((v) => v !== 0);
  assert.equal(filled.length, 2);
  assert.ok(filled.every((v) => v === 2 || v === 4));
});

test('canMove is false only on a locked full board', () => {
  const locked = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ];
  assert.equal(G.canMove(locked), false);

  const mergeable = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 4]
  ];
  assert.equal(G.canMove(mergeable), true);

  const withGap = G.createGrid();
  withGap[0][0] = 2;
  assert.equal(G.canMove(withGap), true);
});

test('maxTile finds the highest value', () => {
  const grid = G.createGrid();
  grid[1][2] = 128;
  grid[3][0] = 64;
  assert.equal(G.maxTile(grid), 128);
  assert.equal(G.maxTile(G.createGrid()), 0);
});

test('a long random game keeps the board consistent', () => {
  const dirs = ['left', 'right', 'up', 'down'];
  let rngSeed = 12345;
  const rng = () => {
    rngSeed = (rngSeed * 1103515245 + 12345) % 2147483648;
    return rngSeed / 2147483648;
  };

  const game = G.newGame(rng);
  let score = 0;
  let moves = 0;

  for (let i = 0; i < 5000 && G.canMove(game.grid); i++) {
    const dir = dirs[Math.floor(rng() * dirs.length) % dirs.length];
    const result = G.move(game.grid, dir);
    if (!result.moved) continue;
    score += result.gained;
    game.grid = result.grid;
    G.spawnTile(game.grid, rng);
    moves++;

    for (const row of game.grid) {
      assert.equal(row.length, 4);
      for (const value of row) {
        assert.ok(Number.isInteger(value) && value >= 0, `bad tile ${value}`);
        assert.ok(value === 0 || (value & (value - 1)) === 0, `tile ${value} is not a power of two`);
      }
    }
  }

  assert.ok(moves > 20, `expected the game to progress, got ${moves} moves`);
  assert.ok(score > 0, 'expected a positive score');
  assert.ok(G.maxTile(game.grid) >= 4, 'expected merges to happen');
});
