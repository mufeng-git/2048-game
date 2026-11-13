(function (global) {
  'use strict';

  var SIZE = 4;

  function createGrid() {
    var grid = [];
    for (var r = 0; r < SIZE; r++) grid.push(new Array(SIZE).fill(0));
    return grid;
  }

  function cloneGrid(grid) {
    return grid.map(function (row) { return row.slice(); });
  }

  function gridsEqual(a, b) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  // Collapse one line toward index 0, merging equal neighbours once each.
  function compressLine(line) {
    var tiles = line.filter(function (v) { return v !== 0; });
    var out = [];
    var gained = 0;
    for (var i = 0; i < tiles.length; i++) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        var merged = tiles[i] * 2;
        out.push(merged);
        gained += merged;
        i++;
      } else {
        out.push(tiles[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    return { line: out, gained: gained };
  }

  function toCols(grid) {
    var cols = [];
    for (var c = 0; c < SIZE; c++) {
      var col = [];
      for (var r = 0; r < SIZE; r++) col.push(grid[r][c]);
      cols.push(col);
    }
    return cols;
  }

  function fromCols(cols) {
    var grid = createGrid();
    for (var c = 0; c < SIZE; c++) {
      for (var r = 0; r < SIZE; r++) grid[r][c] = cols[c][r];
    }
    return grid;
  }

  function rev(a) { return a.slice().reverse(); }

  function move(grid, dir) {
    var gained = 0;
    function apply(line) {
      var res = compressLine(line);
      gained += res.gained;
      return res.line;
    }

    var result;
    if (dir === 'left') {
      result = grid.map(function (row) { return apply(row); });
    } else if (dir === 'right') {
      result = grid.map(function (row) { return rev(apply(rev(row))); });
    } else if (dir === 'up') {
      result = fromCols(toCols(grid).map(function (col) { return apply(col); }));
    } else if (dir === 'down') {
      result = fromCols(toCols(grid).map(function (col) { return rev(apply(rev(col))); }));
    } else {
      throw new Error('unknown direction: ' + dir);
    }

    return { grid: result, gained: gained, moved: !gridsEqual(grid, result) };
  }

  function emptyCells(grid) {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) cells.push([r, c]);
      }
    }
    return cells;
  }

  // Writes a new tile into an empty cell. Returns null when the board is full.
  function spawnTile(grid, rng) {
    var random = rng || Math.random;
    var cells = emptyCells(grid);
    if (cells.length === 0) return null;
    var pick = cells[Math.floor(random() * cells.length) % cells.length];
    var value = random() < 0.9 ? 2 : 4;
    grid[pick[0]][pick[1]] = value;
    return { row: pick[0], col: pick[1], value: value };
  }

  function maxTile(grid) {
    var max = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) if (grid[r][c] > max) max = grid[r][c];
    }
    return max;
  }

  function canMove(grid) {
    if (emptyCells(grid).length > 0) return true;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c];
        if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
        if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  function newGame(rng) {
    var grid = createGrid();
    spawnTile(grid, rng);
    spawnTile(grid, rng);
    return { grid: grid, score: 0 };
  }

  var api = {
    SIZE: SIZE,
    createGrid: createGrid,
    cloneGrid: cloneGrid,
    gridsEqual: gridsEqual,
    compressLine: compressLine,
    move: move,
    emptyCells: emptyCells,
    spawnTile: spawnTile,
    maxTile: maxTile,
    canMove: canMove,
    newGame: newGame
  };

  global.TwentyFortyEight = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
