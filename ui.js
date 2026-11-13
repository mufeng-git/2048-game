(function () {
  'use strict';

  var G = window.TwentyFortyEight;
  var BEST_KEY = '2048-best';

  var boardEl = document.getElementById('board');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlayEl = document.getElementById('overlay');
  var overlayTextEl = document.getElementById('overlay-text');
  var undoBtn = document.getElementById('undo');

  var cells = [];
  var state = { grid: null, score: 0, best: 0, over: false, won: false };
  var history = [];
  var prevGrid = null;

  function readBest() {
    var raw = window.localStorage ? window.localStorage.getItem(BEST_KEY) : null;
    var n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  function writeBest(value) {
    try {
      if (window.localStorage) window.localStorage.setItem(BEST_KEY, String(value));
    } catch (err) { /* storage can be blocked; the game still works */ }
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    cells = [];
    for (var i = 0; i < G.SIZE * G.SIZE; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }

  function render() {
    for (var r = 0; r < G.SIZE; r++) {
      for (var c = 0; c < G.SIZE; c++) {
        var value = state.grid[r][c];
        var cell = cells[r * G.SIZE + c];
        var previous = prevGrid ? prevGrid[r][c] : 0;
        cell.textContent = value === 0 ? '' : String(value);
        cell.className = 'cell' + (value ? ' tile tile-' + (value > 2048 ? 'super' : value) : '');
        if (value !== 0 && value !== previous) {
          cell.classList.add(previous === 0 ? 'appear' : 'merge');
        }
      }
    }
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(state.best);
    undoBtn.disabled = history.length === 0;
    prevGrid = G.cloneGrid(state.grid);
  }

  var nb = null;

  function persistBest() {
    if (state.score > state.best) {
      state.best = state.score;
      writeBest(state.best);
    }
  }

  function startGame() {
    state = { grid: null, score: 0, best: state.best, over: false, won: false };
    var fresh = G.newGame();
    state.grid = fresh.grid;
    state.score = fresh.score;
    history = [];
    prevGrid = null;
    overlayEl.hidden = true;
    render();
  }

  function pushHistory() {
    history.push({ grid: G.cloneGrid(state.grid), score: state.score });
    if (history.length > 20) history.shift();
  }

  function showOverlay(text) {
    overlayTextEl.textContent = text;
    overlayEl.hidden = false;
  }

  function afterMove(result) {
    state.grid = result.grid;
    state.score += result.gained;
    G.spawnTile(state.grid);
    persistBest();

    var max = G.maxTile(state.grid);
    if (!state.won && max >= 2048) {
      state.won = true;
      showOverlay('达成 2048');
    }

    if (!G.canMove(state.grid)) {
      state.over = true;
      showOverlay('游戏结束');
    }

    render();
  }

  function move(dir) {
    if (state.over || !state.grid) return;
    var preview = G.move(state.grid, dir);
    if (!preview.moved) return;
    pushHistory();
    afterMove(preview);
  }

  function undo() {
    if (state.over) {
      state.over = false;
      overlayEl.hidden = true;
    }
    var last = history.pop();
    if (!last) return;
    state.grid = last.grid;
    state.score = last.score;
    prevGrid = null;
    overlayEl.hidden = true;
    render();
  }

  var KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down',
    h: 'left', l: 'right', k: 'up', j: 'down'
  };

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var dir = KEYS[event.key];
    if (!dir) return;
    event.preventDefault();
    move(dir);
  });

  var touchStart = null;

  boardEl.addEventListener('touchstart', function (event) {
    if (event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });

  boardEl.addEventListener('touchend', function (event) {
    if (!touchStart) return;
    var touch = event.changedTouches[0];
    var dx = touch.clientX - touchStart.x;
    var dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  document.getElementById('new-game').addEventListener('click', startGame);
  document.getElementById('overlay-restart').addEventListener('click', startGame);
  undoBtn.addEventListener('click', undo);

  buildBoard();
  state.best = readBest();
  startGame();
})();
