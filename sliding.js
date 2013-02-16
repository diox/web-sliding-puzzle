"use strict";

(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
})();

var puzzle = {
    infos: {
        tilesCount: 4,
        difficulty: 2,
        solved: null,
        timeStarted: null,
        timePaused: null,
        timeSpentPausing: null,
        movesCount: null
    },
    tiles: null,
    height: null,
    width: null,
    img: null,
    canvas: null,
    redrawCallback: null,
};

function init() {
    var elm = document.getElementById('file');
    var label = document.getElementById('file_label');
    var paused = document.getElementById('paused');
    var newgame = document.getElementById('newgame');
    var restartgame = document.getElementById('restartgame');

    if (elm.type !== 'file' || 0) {
        /* For browsers without input=file, i.e. Firefox OS, we show the 
           Web Activities "pick", restricting to images.

           We should probably do the test the other way around, testing
           MozActivity presence first, so that browsers without input=file
           and without MozActvity don't throw errors, but testing for
           MozActivity presence doesn't garantee us it will work to pick images.
           ('MozActivity' in window is true in FF Desktop, but unusable, and we
            can only know that too late in the process, after the user has
            already clicked the button)
        */
        elm.type = "button";
        elm.value = label.textContent;
        elm.addEventListener('click', function(e) {
            e.preventDefault();
            var pick = new MozActivity({
                name: "pick",
                data: {
                    type: ["image/png", "image/jpg", "image/jpeg"]
                }
            });
            pick.onsuccess = function() {
                // Create image and set the returned blob as the src
                puzzle.init(this.result.blob);
            };
        });
        label.style.display = 'none';
    } else {
        elm.addEventListener('change', function() {
            if (this.files.length) {
                puzzle.init(this.files[0]);
            }
        });
    }
    window.addEventListener('beforeunload', function() {
        puzzle.showPauseScreen();
    });
    paused.addEventListener('mousedown', puzzle.hidePauseScreen);
    paused.addEventListener('touchstart', puzzle.hidePauseScreen);
    newgame.addEventListener('mousedown', puzzle.newGame);
    newgame.addEventListener('touchstart', puzzle.newGame);
    restartgame.addEventListener('mousedown', puzzle.restartGame);
    restartgame.addEventListener('touchstart', puzzle.restartGame);
    if (typeof localStorage['puzzleInfos'] !== 'undefined' &&
        typeof localStorage['puzzleSource'] !== 'undefined' &&
        typeof localStorage['puzzleTiles'] !== 'undefined') {
        puzzle.resumeGame();
    } else {
        showGui();
    }
}

function showGui() {
    document.getElementById('gui').classList.remove('hidden');
}

function hideGui() {
    document.getElementById('gui').classList.add('hidden');
}

function Tile(x, y) {
    this.x = x;
    this.y = y;
    this.originalX = x;
    this.originalY = y;
    this.elm = null;
}

Tile.prototype.isEmpty = function() {
    // FIXME: use everywhere
    return (this === puzzle.tiles.empty);
};

Tile.prototype.debug = function(delay) {
    setTimeout((function() {
        if (this.elm) {
            this.elm.style.opacity = '0.5';
            this.elm.style.outline = '1px dashed yellow';
        }
    }).bind(this), delay || 20);
};

Tile.prototype.eventHandler = function(e) {
    if (!document.body.classList.contains('moving')) {
        this.move(true);
    }
    e.preventDefault();
    e.stopPropagation();
};

Tile.prototype.move = function(incrementCount) {
    var empty = puzzle.tiles.empty;

    if (incrementCount !== false) {
        incrementCount = true;
    }
    
    if (this.canMove()) {
        if (incrementCount) {
            puzzle.infos.movesCount++;
        }
        document.body.classList.add('moving');
        this.originalX = this.x;
        this.originalY = this.y;
        this.x = empty.x;
        this.y = empty.y;
        empty.x = this.originalX;
        empty.y = this.originalY;
        this.reposition();
    } else if (this.canLineMove('x')) {
        if (incrementCount) {
            puzzle.infos.movesCount++;
        }
        this.lineMove('x', 'y');
    } else if (this.canLineMove('y')) {
        if (incrementCount) {
            puzzle.infos.movesCount++;
        }
        this.lineMove('y', 'x');
    }

    localStorage['puzzleTiles'] = JSON.stringify(puzzle.tiles);
};

Tile.prototype.lineMove = function(mainAxis, secondaryAxis) {
    function sortTiles(a, b) {
        if (this[secondaryAxis] > puzzle.tiles.empty[secondaryAxis]) {
            return (a[secondaryAxis] - b[secondaryAxis]);
        } else {
            return (b[secondaryAxis] - a[secondaryAxis]);
        }
    }

    var tiles = [];
    for (var i = 0; i < puzzle.tiles.length; i++) {
        for (var j = 0; j < puzzle.tiles[i].length; j++) {
            var tile = puzzle.tiles[i][j];
            if (tile.isEmpty()) {
                continue;
            }
            if (tile[mainAxis] === this[mainAxis]) {
                if (this[secondaryAxis] > puzzle.tiles.empty[secondaryAxis]) {
                    if (tile[secondaryAxis] > puzzle.tiles.empty[secondaryAxis] 
                        && tile[secondaryAxis] <= this[secondaryAxis]) {
                        tiles.push(tile);
                    }
                } else {
                    if (tile[secondaryAxis] < puzzle.tiles.empty[secondaryAxis]
                     && tile[secondaryAxis] >= this[secondaryAxis]) {
                        tiles.push(tile);
                    }
                }
            }
        }
    }
    tiles.sort(sortTiles.bind(this));
    puzzle.moving = tiles.length;
    tiles.forEach(function(item) {
        item.move(false);
    });
};

Tile.prototype.canLineMove = function(property) {
    var empty = puzzle.tiles.empty;
    return (this !== puzzle.tiles.empty /* don't consider empty tile as moveable */
         && empty[property] === this[property]);
};

Tile.prototype.canMove = function() {
    var empty = puzzle.tiles.empty;
    return (this !== puzzle.tiles.empty /* don't consider empty tile as moveable */
         && Math.abs(empty.x - this.x) + Math.abs(empty.y - this.y) === 1);
};

Tile.prototype.reposition = function() {
    var x, y, oldX, oldY, peekX, peekY;

    function realReposition(e) {
        e.stopPropagation();
        this.classList.remove('peek');
        this.style.webkitTransform = 'translateX(' + x + 'px) translateY(' + y + 'px)';
        this.style.transform = 'translateX(' + x + 'px) translateY(' + y + 'px)';
        this.removeEventListener('transitionend', realReposition);
        this.removeEventListener('webkitTransitionEnd', realReposition);
    }

    if (this.isEmpty()) {
        return;
    }

    x = this.x * (puzzle.width / puzzle.infos.tilesCount);
    y = this.y * (puzzle.height / puzzle.infos.tilesCount);
    // move 1% in the right direction before doing the real move, to avoid
    // ugly flickering with Firefox OS
    this.elm.addEventListener('transitionend', realReposition);
    this.elm.addEventListener('webkitTransitionEnd', realReposition);
    oldX = this.originalX * (puzzle.width / puzzle.infos.tilesCount);
    oldY = this.originalY * (puzzle.height / puzzle.infos.tilesCount);

    peekX = Math.round(oldX + (x - oldX) / 100);
    peekY = Math.round(oldY + (y - oldY) / 100);
    this.elm.classList.add('peek');
    this.elm.offsetLeft; // Force browser to acknowledge it needs to make a transition
    this.elm.style.webkitTransform = 'translateX(' + peekX + 'px) translateY(' + peekY + 'px)';
    this.elm.style.transform = 'translateX(' + peekX + 'px) translateY(' + peekY + 'px)';
};

puzzle.init = function(file) {
    var fileReader = new FileReader();
    fileReader.onload = function(e) {
        // Store file in localStorage to be able to resume game later.
        // FIXME: refuse files too big ?
        localStorage['puzzleSource'] = e.target.result;
    };
    fileReader.readAsDataURL(file);
    puzzle.initVars();
    puzzle.initElements(window.URL.createObjectURL(file), file.type, function() {
        hideGui();
        puzzle.shuffle();
    });
};

puzzle.initVars = function() {
    puzzle.infos.solved = false;
    puzzle.infos.movesCount = 0;
    puzzle.infos.timePaused = null;
    puzzle.infos.timeSpentPausing = 0;
    puzzle.infos.timeStarted = (new Date()).getTime();
};

puzzle.initElements = function(fileURL, fileType, callback) {
    var container = document.createElement('div');

    container.id = 'container';
    document.body.appendChild(container);
    puzzle.height = window.innerHeight;
    puzzle.width = window.innerWidth;

    puzzle.createTiles();

    if (fileType.split('/')[0] === 'video') {
        puzzle.img = document.createElement('video');
        puzzle.img.addEventListener("loadeddata", function() {
            puzzle.img.width = puzzle.img.videoWidth;
            puzzle.img.width = puzzle.img.videoWidth;
            puzzle.initialDraw();
            callback();
        });
        puzzle.img.autoplay = true;
        puzzle.img.volume = 0;  // muted doesn't seem to be enough for chrome
        puzzle.img.muted = true;
        puzzle.img.loop = true;
        puzzle.redrawCallback = function() {
            requestAnimationFrame(puzzle.redraw.bind(puzzle, false));
        };
        puzzle.img.src = fileURL;
    } else {
        puzzle.redrawCallback = null;
        puzzle.img = new Image();
        puzzle.img.onload = function() {
            puzzle.initialDraw();
            callback();
        };
        puzzle.img.src = fileURL;
    }
    container.addEventListener('mousedown', puzzle.showPauseScreen);
    container.addEventListener('touchstart', puzzle.showPauseScreen);
};

puzzle.resumeGame = function() {
    var puzzleInfos = JSON.parse(localStorage['puzzleInfos']);
    var puzzleTiles = JSON.parse(localStorage['puzzleTiles']);
    var start, end, fileType, fileURL;
    // FIXME: refactor w/ init()
    puzzle.initVars();
    fileURL = localStorage['puzzleSource']
    start = fileURL.indexOf(':') + 1;
    end = fileURL.indexOf(';');
    fileType = fileURL.slice(start, end);
    puzzle.initElements(fileURL, fileType, function() {
        puzzle.infos = puzzleInfos;
        puzzle.infos.timeSpentPausing += (new Date()).getTime() - puzzle.infos.timePaused;
        for (var i = 0; i < puzzleTiles.length; i++) {
            for (var j = 0; j < puzzleTiles[i].length; j++) {
                puzzle.tiles[i][j].x = puzzleTiles[i][j].x;
                puzzle.tiles[i][j].y = puzzleTiles[i][j].y;
                puzzle.tiles[i][j].reposition();
            }
        }
        hideGui();
    });
};

puzzle.showPauseScreen = function(e) {
    var t;
    puzzle.infos.timePaused = (new Date()).getTime();
    t = puzzle.infos.timePaused - puzzle.infos.timeStarted - puzzle.infos.timeSpentPausing;

    if (typeof puzzle.img.pause !== 'undefined') {
        puzzle.img.pause();
    }

    localStorage['puzzleInfos'] = JSON.stringify(puzzle.infos);
    document.getElementById('elapsed').textContent = Math.round(t / 1000);
    document.getElementById('moves').textContent = puzzle.infos.movesCount;
    document.getElementById('paused').style.display = 'block';
    e.preventDefault();
    e.stopPropagation();
};

puzzle.hidePauseScreen = function(e) {
    puzzle.infos.timeSpentPausing += (new Date()).getTime() - puzzle.infos.timePaused;

    if (typeof puzzle.img.play !== 'undefined') {
        puzzle.img.play();
    }

    localStorage['puzzleInfos'] = JSON.stringify(puzzle.infos);
    document.getElementById('paused').style.display = 'none';
    e.preventDefault();
    e.stopPropagation();
};

puzzle.initialDraw = function() {
    function transitionEnd(e) {
        if (e.target.tagName.toLowerCase() !== 'canvas') {
            return;
        }
        if (puzzle.moving > 0) {
            puzzle.moving--;
        }
        if (!puzzle.moving) {
            document.body.classList.remove('moving');
            puzzle.checkSolved();
        }
    }
    puzzle.initCanvas();
    puzzle.redraw(true);
    puzzle.moving = 0;
    document.body.addEventListener('transitionend', transitionEnd);
    document.body.addEventListener('webkitTransitionEnd', transitionEnd);
    document.defaultView.addEventListener('resize', function() {
        puzzle.redraw(true);
    });
    // FIXME: is "resize" enough ?
    //document.defaultView.addEventListener("deviceorientation", puzzle.redraw, true);
};

puzzle.initCanvas = function() {
    if (puzzle.canvas) {
        return puzzle.canvas;
    }
    puzzle.canvas = document.createElement('canvas');
    puzzle.canvas.className = 'hidden';
    puzzle.canvas.id = 'finished';
    puzzle.canvas.addEventListener('mousedown', puzzle.newGame);
    puzzle.canvas.addEventListener('touchstart', puzzle.newGame);
    document.body.appendChild(puzzle.canvas);
    return puzzle.canvas;
};

puzzle.redraw = function(reposition) {
    document.body.classList.add('moving');
    var img = puzzle.img;
    var ctx = null, puzzleOrientation = null, imageOrientation = null;
    var canvas = puzzle.canvas;

    puzzle.height = window.innerHeight;
    puzzle.width = window.innerWidth;
    canvas.width = puzzle.width;
    canvas.height = puzzle.height;
    ctx = canvas.getContext('2d');

    if (puzzle.width !== puzzle.height) {
        puzzleOrientation = (puzzle.width / puzzle.height) > 1;
    }
    if (img.width !== img.height) {
        imageOrientation = (img.width / img.height) > 1;
    }
    if (puzzleOrientation !== null && imageOrientation !== null &&
        imageOrientation !== puzzleOrientation) {
        // If image orientation and puzzle orientation differ - and we are not
        // drawing to/from a square - we need to rotate the canvas 90 deg to
        // display the image.
        ctx.rotate(90 * Math.PI / 180);
        ctx.translate(0, -canvas.width);
        ctx.drawImage(img, 0, 0, canvas.height, canvas.width);
    } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    for (var i = 0; i < puzzle.tiles.length; i++) {
        for (var j = 0; j < puzzle.tiles[i].length; j++) {
            if (i === puzzle.tiles.length -1 && j === puzzle.tiles[i].length -1) {
                continue;
            }
            var tile = puzzle.tiles[i][j];
            var elm = tile.elm;
            elm.width = puzzle.width / puzzle.infos.tilesCount;
            elm.height = puzzle.height / puzzle.infos.tilesCount;
            var sx = i * puzzle.width / puzzle.infos.tilesCount;
            var sy = j * puzzle.height / puzzle.infos.tilesCount;
            var sw = canvas.width / puzzle.infos.tilesCount;
            var sh = canvas.height / puzzle.infos.tilesCount;
            var dx = 0;
            var dy = 0;
            var dw = elm.width;
            var dh = elm.height;
            ctx = elm.getContext('2d');
            ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh);
            ctx.strokeRect(0, 0, dw, dh);
            if (reposition) {
                tile.reposition();
            }
        }
    }
    document.body.classList.remove('moving');
    if (puzzle.redrawCallback) {
        puzzle.redrawCallback();
    }
};

puzzle.shuffle = function(difficulty) {
    var current = null;
    var movesToMake = difficulty || puzzle.infos.difficulty;

    function getAvailableTiles() {
        var availableTiles = [];
        for (var i = 0; i < puzzle.tiles.length; i++) {
            for (var j = 0; j < puzzle.tiles[i].length; j++) {
                var tile = puzzle.tiles[i][j];
                if (tile.canMove() && tile !== current) {
                    availableTiles.push(tile);
                }
            }
        }
        return availableTiles;
    }
    for (var d = 0; d < movesToMake; d++) {
        var available = getAvailableTiles();
        var i = Math.round(Math.random() * (available.length - 1));
        current = available[i];
        current.move(false);
    }
    localStorage['puzzleInfos'] = JSON.stringify(puzzle.infos);
};

puzzle.checkSolved = function() {
    if (puzzle.infos.solved) {
        return;
    }
    var solved = true;
    for (var i = 0; i < puzzle.tiles.length; i++) {
        for (var j = 0; j < puzzle.tiles[i].length; j++) {
            var tile = puzzle.tiles[i][j];
            if (i !== tile.x || j !== tile.y) {
                solved = false;
                break;
            }
        }
    }
    if (solved) {
        puzzle.resetStorage();
        document.getElementById('finished').classList.remove('hidden');
        alert('Congratulations! Tap the image to play again');
        puzzle.infos.solved = solved;
    }
};

puzzle.resetStorage = function() {
    delete localStorage['puzzleInfos'];
    delete localStorage['puzzleSource'];
    delete localStorage['puzzleTiles'];
};

puzzle.newGame = function(e) {
    puzzle.resetStorage();
    var container = document.getElementById('container');
    var paused = document.getElementById('paused');
    paused.style.display = 'none';
    container.parentNode.removeChild(container, true);
    puzzle.canvas.classList.add('hidden');
    if (typeof puzzle.img.pause !== 'undefined') {
        puzzle.img.pause();
    }
    e.preventDefault();
    e.stopPropagation();
    showGui();
};

puzzle.restartGame = function(e) {
    var paused = document.getElementById('paused');
    paused.style.display = 'none';

    for (var i = 0; i < puzzle.tiles.length; i++) {
        for (var j = 0; j < puzzle.tiles[i].length; j++) {
            var tile = puzzle.tiles[i][j];
            tile.x = i;
            tile.y = j;
        }
    }
    puzzle.initVars();
    puzzle.initialDraw();
    puzzle.shuffle();
    e.preventDefault();
    e.stopPropagation();
};

puzzle.createTiles = function() {
    var container = document.getElementById('container');

    puzzle.tiles = new Array(puzzle.infos.tilesCount);
    puzzle.tiles.empty = new Tile(puzzle.infos.tilesCount - 1, puzzle.infos.tilesCount - 1);
    for (var i = 0; i < puzzle.infos.tilesCount; i++) {
        puzzle.tiles[i] = new Array(puzzle.infos.tilesCount);
        for (var j = 0; j < puzzle.infos.tilesCount; j++) {
            if (i === puzzle.tiles.empty.x && j === puzzle.tiles.empty.y) {
                puzzle.tiles[i][j] = puzzle.tiles.empty;
            } else {
                var tile = new Tile(i, j);
                puzzle.tiles[i][j] = tile;
                if (!tile.elm) {
                    tile.elm = document.createElement('canvas');
                }
                tile.elm.className = 'tile';
                tile.elm.addEventListener('touchstart', tile.eventHandler.bind(tile));
                tile.elm.addEventListener('mousedown', tile.eventHandler.bind(tile));
                container.appendChild(tile.elm);
            }    
        }
    }
};