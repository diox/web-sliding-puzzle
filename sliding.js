"use strict";

(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
})();

var puzzle = {
    tilesCount: 4,
    difficulty: 42,
    height: null,
    width: null,
    tiles: null,
    image: null,
    solved: null,
    img: null,
    canvas: null,
    redrawCallback: null
};

function init() {
    var elm = document.getElementById('file');
    var label = document.getElementById('file_label');
    if (elm.type !== 'file') {
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
        document.getElementById('gui').appendChild(elm);
    } else {
        elm.addEventListener('change', function() {
            if (this.files.length) {
                puzzle.init(this.files[0]);
            }
        });
        document.getElementById('gui').appendChild(elm);
    }
    showGui();
}

function showGui() {
    document.getElementById('gui').classList.remove('hidden');
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
        this.move();
    }
    e.preventDefault();
    e.stopPropagation();
};

Tile.prototype.move = function() {
    var empty = puzzle.tiles.empty;
    
    if (this.canMove()) {
        document.body.classList.add('moving');
        this.originalX = this.x;
        this.originalY = this.y;
        this.x = empty.x;
        this.y = empty.y;
        empty.x = this.originalX;
        empty.y = this.originalY;
        this.reposition();
    } else if (this.canLineMove('x')) {
        this.lineMove('x', 'y');
    } else if (this.canLineMove('y')) {
        this.lineMove('y', 'x');
    }
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
        item.move();
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
    function realReposition(e) {
        e.stopPropagation();
        this.classList.remove('peek');
        style.webkitTransform = 'translateX(' + x + 'px) translateY(' + y + 'px)';
        style.transform = 'translateX(' + x + 'px) translateY(' + y + 'px)';
        this.removeEventListener('transitionend', realReposition);
        this.removeEventListener('webkitTransitionEnd', realReposition);
    }

    var style = this.elm.style;
    var x = this.x * (puzzle.width / puzzle.tilesCount);
    var y = this.y * (puzzle.height / puzzle.tilesCount);
    this.elm.classList.add('peek');
    // move 1% in the right direction before doing the real move, to avoid
    // ugly flickering with Firefox OS
    this.elm.addEventListener('transitionend', realReposition);
    this.elm.addEventListener('webkitTransitionEnd', realReposition);
    var oldX = this.originalX * (puzzle.width / puzzle.tilesCount);
    var oldY = this.originalY * (puzzle.height / puzzle.tilesCount);
    var peekX = Math.round(oldX + (x - oldX) / 100);
    var peekY = Math.round(oldY + (y - oldY) / 100);
    style.webkitTransform = 'translateX(' + peekX + 'px) translateY(' + peekY + 'px)';
    style.transform = 'translateX(' + peekX + 'px) translateY(' + peekY + 'px)';
};

puzzle.init = function(file) {
    var container = document.createElement('div');
    container.id = 'container';
    document.body.appendChild(container);

    puzzle.solved = false;
    puzzle.height = window.innerHeight;
    puzzle.width = window.innerWidth;
    puzzle.createTiles();

    document.getElementById('gui').classList.add('hidden');

    if (file.type.split('/')[0] == 'video') {
        puzzle.img = document.createElement('video');
        puzzle.img.addEventListener("loadeddata", function() {
            puzzle.img.width = puzzle.img.videoWidth;
            puzzle.img.width = puzzle.img.videoWidth;
            puzzle.initialDraw();
        });
        puzzle.img.autoplay = true;
        puzzle.img.muted = true;
        puzzle.img.loop = true;
        puzzle.redrawCallback = function() {
            requestAnimationFrame(puzzle.redraw.bind(puzzle, false));
        }
        puzzle.img.src = window.URL.createObjectURL(file);
        container.addEventListener('mousedown', puzzle.playPause);
        container.addEventListener('touchstart', puzzle.playPause);
    } else {
        puzzle.redrawCallback = null;
        puzzle.img = new Image();
        puzzle.img.onload = puzzle.initialDraw;
        puzzle.img.src = window.URL.createObjectURL(file);
    }
};

puzzle.playPause = function() {
    if (puzzle.img.paused) {
        puzzle.img.play();
    } else {
        puzzle.img.pause();
    }
}

puzzle.initialDraw = function(callback) {
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
    puzzle.shuffle();
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
    puzzle.canvas.addEventListener('mousedown', puzzle.replayCallback);
    puzzle.canvas.addEventListener('touchstart', puzzle.replayCallback);
    document.body.appendChild(puzzle.canvas);
    return puzzle.canvas;
}

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
            elm.width = puzzle.width / puzzle.tilesCount;
            elm.height = puzzle.height / puzzle.tilesCount;
            var sx = i * puzzle.width / puzzle.tilesCount;
            var sy = j * puzzle.height / puzzle.tilesCount;
            var sw = canvas.width / puzzle.tilesCount;
            var sh = canvas.height / puzzle.tilesCount;
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

puzzle.shuffle = function() {
    var current = null;

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
    for (var d = 0; d < puzzle.difficulty; d++) {
        var available = getAvailableTiles();
        var i = Math.round(Math.random() * (available.length - 1));
        current = available[i];
        current.move(true);
    }
};

puzzle.checkSolved = function() {
    if (puzzle.solved) {
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
        document.getElementById('finished').classList.remove('hidden');
        alert('Congratulations! Tap the image to play again');
        puzzle.solved = solved;
    }
};

puzzle.replayCallback = function() {
    var canvas = document.getElementById('finished');
    var container = document.getElementById('container');
    container.parentNode.removeChild(container, true);
    canvas.parentNode.removeChild(canvas, true);
    if (typeof puzzle.img.pause !== 'undefined') {
        puzzle.img.pause();
    }
    showGui();
};

puzzle.createTiles = function() {
    var container = document.getElementById('container');

    puzzle.tiles = new Array(puzzle.tilesCount);
    puzzle.tiles.empty = new Tile(puzzle.tilesCount - 1, puzzle.tilesCount - 1);
    for (var i = 0; i < puzzle.tilesCount; i++) {
        puzzle.tiles[i] = new Array(puzzle.tilesCount);
        for (var j = 0; j < puzzle.tilesCount; j++) {
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