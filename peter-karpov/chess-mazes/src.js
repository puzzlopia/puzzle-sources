(function (puzzlePlayer) {
  'use strict';

  var webRoot = PAGE_DATA.SYS.webRoot;

  puzzlePlayer.loadPuzzle({
    pid: "%THIS_CONTENT_PID%",
    structure: webRoot + '/../data/contents/puzzles/%THIS_CONTENT_URI%/deploy/descriptor.min.json',
    clientBuildGame: buildGame
  });

  /**
   * @summary Reference for piece types.
   */
  var CHESS_PIECE_TYPES = [
    1, //king
    2, //queen
    3, //rook
    4, //bishop
    5, //knight
    6  //pawn
  ],
    CHESS_MAZE_OBJECTIVE_ID = 99;

  /**
   * @summary Puzzle level definition using previous definitions for objective and piece types.
   *  Also negative values means opponent pieces.
   */
  var initialChessState = [
    [0, 0, 0, 99, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, -3, 0, 0, 0, -5, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, -3, 0, 0, 0, 0, 0],
    [5, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0]
  ];

  /** @const */
  var SOUND_FUSION_VOLUME = 0.8;

  // var COLOR_PALETTE = {
  //   shadow: 0x333533,
  //   shadowDark: 0x242423,
  //   chessPulse: 0xFFFFFF,

  //   chessboardLight: 0xE8EDDF,
  //   chessboardDark: 0xCFDBD5,

  //   opponent: 0xF4CC5D,
  //   opponentActive: 0xF45D5F,

  //   objective: 0x85F45D,
  //   objectivePulse: 0xFFFFFF,

  //   player: 0xF4F25D,
  //   playerActive: 0xFFFFFF
  // };

  var COLOR_PALETTE = {
    shadow: 0x242329,
    //shadowDark: 0x242423,
    chessPulse: 0xFFFFFF,

    chessboardLight: 0xE10A3C,
    chessboardDark: 0xDA365C,

    opponent: 0x242329,
    opponentActive: 0x3A24A9,

    objective: 0x86E500,
    objectivePulse: 0xFFFFFF,

    player: 0x242329,
    playerActive: 0xFFFFFF
  };


  /**
   * @summary Returns the sprite name from piece id.
   */
  var getPieceSprite = function (pieceTypeId) {
    var color = pieceTypeId < 0 ? 'b' : 'w',
      typeId = pieceTypeId < 0 ? -pieceTypeId : pieceTypeId;

    if (typeId === 1) {
      return color + "_King";
    } else if (typeId === 2) {
      return color + "_Queen";
    } else if (typeId === 3) {
      return color + "_Rook";
    } else if (typeId === 4) {
      return color + "_Bishop";
    } else if (typeId === 5) {
      return color + "_Knight";
    } else if (typeId === 6) {
      return color + "_Pawn";
    }
    console.error("[::getPieceSprite] Unknown piece type " + pieceTypeId);
    return "";
  };

  /**
   * @summary Function called when there exists an instance of the game.
   */
  function buildGame(clientGameApp) {

    // ===============================================================================================
    // CHESS CELL PRESS ANIMATION
    (function () {

      /**
       * @summary Implements a pulse animation
       */
      function CellAnimation(parent, pxWidth, pxHeight, color, type) {
        this._parent = parent;
        this._pxWidth = pxWidth;
        this._pxHeight = pxHeight;
        this._grObject = new pzlpEngine2d.PIXI.Graphics();
        this._parent.addChildAt(this._grObject, 1);
        this._color = color ? color : 0xFFFFFF;
        this._active = false;
        this._isStatic = type === 'static';

        // Time in milliseconds
        this._timeOffset = 0;
        this._expansionDuration = 600;
        this._sleepDuration = 2000;
        this._totalDuration = this._expansionDuration + this._sleepDuration;

        this._cx = this._pxWidth / 2;
        this._cy = this._pxHeight / 2;

        this._toBeFinished = false;
      }
      CellAnimation.constructor = CellAnimation;

      _.extend(CellAnimation.prototype, {

        start: function () {
          this._active = true;
        },

        /**
         * @summary Acts like a pause.
         */
        isActive: function () {
          return this._active;
        },

        /**
         * @summary Sets the animation as ended, enabling finishing it and remaining inactive.
         */
        end: function () {
          this._toBeFinished = true;
        },

        /**
         * @summary Stops the animation and removes the graphics so that no more frames are drawn.
         */
        kill: function () {
          this._parent.removeChild(this._grObject);
          this._active = false;
          this._grObject = null;
          this._parent = null;
        },

        /**
         * @summary Starts the animation but also marks it to be finished, so only 1 cycle is animated.
         */
        pulse: function () {
          this._active = true;
          this._toBeFinished = true;
          this._timeOffset = 0;
        },

        /**
         * @summary Two phases: 1st is expansion, 2nd is sleep
         */
        update: function (timeStep) {
          this._grObject.clear();

          if (this._timeOffset === 0) {
            this._timeOffset = timeStep;
          }

          var diff = (timeStep - this._timeOffset) % this._totalDuration;
          if (diff < this._expansionDuration) {
            var pct = diff / this._expansionDuration,
              pctr2 = Math.sqrt(pct),
              d = this._isStatic ? 0.5 * this._pxWidth : 0.48 * this._pxWidth * pctr2;

            this._grObject.beginFill(this._color, 1 - pctr2);
            this._grObject.drawRect(this._cx - d, this._cy - d, 2 * d, 2 * d);
          } else if (this._toBeFinished) {
            this._active = false;
            this._toBeFinished = false;
          }
        }
      });

      pzlpEngine2d.CellAnimation = CellAnimation;
    }());

    // ===============================================================================================
    // CHESS RULES: implements several chess logics.
    (function () {

      var ChessRules = {};
      _.extend(ChessRules, {

        /**
         * @summary Adds all 'seen' positions in the row, from cur position (curRow, curCol).
         */
        addRows: function (positions, matrix, curRow, curCol) {
          var k,
            maxRow = matrix.getRows(),
            maxCol = matrix.getCols();

          for (k = curCol + 1; k < maxCol; k++) {
            var cell = matrix.getCellAt(curRow, k);
            if (cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(curRow, k);
          }
          for (k = curCol - 1; k >= 0; k--) {
            var cell = matrix.getCellAt(curRow, k);
            if (cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(curRow, k);
          }
        },
        
        /**
         * @summary Adds all 'seen' positions in the column, from cur position (curRow, curCol).
         */
        addCols: function (positions, matrix, curRow, curCol) {
          var k,
            maxRow = matrix.getRows(),
            maxCol = matrix.getCols();

          for (k = curRow + 1; k < maxRow; k++) {
            var cell = matrix.getCellAt(k, curCol);
            if (cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(k, curCol);
          }
          for (k = curRow - 1; k >= 0; k--) {
            var cell = matrix.getCellAt(k, curCol);
            if (cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(k, curCol);
          }
        },

        /**
         * @summary Adds all 'seen' positions in both diagonals, from cur position (curRow, curCol).
         */
        addDiagonals: function (positions, matrix, curRow, curCol) {
          var k,
            maxRow = matrix.getRows(),
            maxCol = matrix.getCols();

          // Up left
          for (k = 0; k < curRow; k++) {
            var row = curRow - k - 1,
              col = curCol - k - 1,
              cell = (0 <= row && 0 <= col ? matrix.getCellAt(row, col) : null);

            if (!cell || cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(row, col);
          }
          // Up right
          for (k = 0; k < curRow; k++) {
            var row = curRow - k - 1,
              col = curCol + k + 1,
              cell = (0 <= row && col < maxCol ? matrix.getCellAt(row, col) : null);

            if (!cell || cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(row, col);
          }

          // Down left
          for (k = 0; k < maxRow; k++) {
            var row = curRow + k + 1,
              col = curCol - k - 1,
              cell = (row < maxRow && 0 <= col ? matrix.getCellAt(row, col) : null);
            
            if (!cell || cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(row, col);
          }

          // Down right
          for (k = 0; k < maxRow; k++) {
            var row = curRow + k + 1,
              col = curCol + k + 1,
              cell = (row < maxRow && col < maxCol ? matrix.getCellAt(row, col) : null);
            
            if (!cell || cell.getPieceType() !== 0) {
              break;
            }
            positions.addPos(row, col);
          }
        }
      });

      pzlpEngine2d.ChessRules = ChessRules;
    }());


    // ===============================================================================================
    /** CHESS CELL: the interactive base cell used for the game. Placed at a constant row col position, it
     *  can hold any chess piece or be an objective cell.
     */
    (function () {

      function ChessCell() {
        this._matrix = null;
        this._row = 0;
        this._col = 0;
        this._grParent = null;
        this._grObject = null;
        this._grShape = null;
        this._sprite = null;
        this._pxWidth = 0;
        this._pxHeight = 0;

        this._animation = null;
        this._pieceTypeId = 0;
        this._isOpponent = false;
        this._isObjective = false;
        this._capturedBy = [];
      }
      ChessCell.constructor = ChessCell;
      _.extend(ChessCell.prototype, {

        init: function (matrix, row, col, grParent, pxLeft, pxTop, pxWidth, pxHeight) {
          this._matrix = matrix;
          this._row = row;
          this._col = col;
          this._grParent = grParent;

          this._grObject = new pzlpEngine2d.PIXI.DisplayObjectContainer();
          this._grObject.position.x = pxLeft;
          this._grObject.position.y = pxTop;
          this._grParent.addChild(this._grObject);

          this._grShape = new pzlpEngine2d.PIXI.Graphics();
          this._grObject.addChild(this._grShape);
                    
          var parity = (row + col) % 2;
          this._grShape.beginFill(parity ? COLOR_PALETTE.chessboardLight : COLOR_PALETTE.chessboardDark, 1);
          this._grShape.drawRect(0, 0, pxWidth, pxHeight);
          this._grShape.hitArea = new pzlpEngine2d.PIXI.Rectangle(0, 0, pxWidth, pxHeight);

          this._pxWidth = pxWidth;
          this._pxHeight = pxHeight;
          this.enable(true);

          this._animation = new pzlpEngine2d.CellAnimation(this._grObject, this._pxWidth, this._pxHeight, COLOR_PALETTE.chessPulse);
        },

        getPieceType: function () {
          return this._pieceTypeId;
        },

        hasOpponentPiece: function () {
          return this._isOpponent;
        },

        getAnimation: function () {
          return this._animation;
        },

        setObjectiveCell: function () {
          this._grShape.clear();
          this._grShape.beginFill(COLOR_PALETTE.objective, 1);
          this._grShape.drawRect(0, 0, this._pxWidth, this._pxHeight);
          this._isObjective = true;
          this._animation = new pzlpEngine2d.CellAnimation(this._grObject, this._pxWidth, this._pxHeight, COLOR_PALETTE.objectivePulse);
          this._animation.start();
        },

        /**
         * @summary Initializes the cell with an opponent piece.
         */
        setOpponentPiece: function (id, spriteName) {
          this._grShape.clear();
          this._grShape.beginFill(COLOR_PALETTE.opponent, 1);
          this._grShape.drawRect(0, 0, this._pxWidth, this._pxHeight);
          this._pieceTypeId = id;
          this._isOpponent = true;
          this._sprite = this._spriteFromName(spriteName);
          this._sprite.tint = COLOR_PALETTE.chessboardLight;
          this._grObject.addChild(this._sprite);
          this.enable(false);

          this._animation = new pzlpEngine2d.CellAnimation(this._grObject, this._pxWidth, this._pxHeight, COLOR_PALETTE.opponentActive, 'static');
          this._animation.pulse();
        },

        _pulseEnemy: function () {
          if (!this._isOpponent) {
            console.error("This cell has no enemy piece!");
          }
          if (this._animation) {
            this._animation.pulse();
          }
        },

        pulseCell: function () {
          if (this._animation && !this._isObjective) {
            this._animation.pulse();
          }
        },

        /**
         * @summary Shows a visual alert coming from opposite capturing pieces (fixed set for each set).
         */
        pulseEnemies: function () {
          if (this._capturedBy.length) {
            for (var k = 0, n = this._capturedBy.length; k < n; k++) {
              this._capturedBy[k]._pulseEnemy();
            }
          }
        },

        setPlayerPiece: function (id, spriteName) {
          this._pieceTypeId = id;
          this._sprite = this._spriteFromName(spriteName);
          this._grObject.addChild(this._sprite);
          this._sprite.tint = COLOR_PALETTE.chessboardLight;
          this._updateCell(true);
        },

        /**
         * @summary Adds a cell as the source of opponent capture position.
         */
        addCapturedBy: function (cell) {
          this._capturedBy.push(cell);
        },

        /**
         * @summary Returns true if the cell is in a capturable position.
         */
        isCapturable: function() {
          return this._capturedBy.length > 0
        },

        /**
         * @summary Updates the cell's aspect.
         */
        _updateCell: function (isPlayerOn) {
          if (isPlayerOn) {
            if (!this._isObjective) {
              this._grShape.clear();
              this._grShape.beginFill(COLOR_PALETTE.player, 1);
              this._grShape.drawRect(0, 0, this._pxWidth, this._pxHeight);

              this._animation = new pzlpEngine2d.CellAnimation(this._grObject, this._pxWidth, this._pxHeight, COLOR_PALETTE.playerActive);
              this._animation.start();
            }
            this.enable(false);
          } else {
            var parity = (this._row + this._col) % 2;
            this._grShape.clear();
            this._grShape.beginFill(parity ? COLOR_PALETTE.chessboardLight : COLOR_PALETTE.chessboardDark, 1);
            this._grShape.drawRect(0, 0, this._pxWidth, this._pxHeight);

            if (this._animation) {
              this._animation.kill();
            }
            this._animation = new pzlpEngine2d.CellAnimation(this._grObject, this._pxWidth, this._pxHeight, COLOR_PALETTE.chessPulse);

            this.enable(true);
          }
        },

        /**
         * @summary Creates and initializes a sprite from the texture name.
         */
        _spriteFromName: function (spriteName) {
          var sprite = pzlpEngine2d.PIXI.Sprite.fromFrame(spriteName);
          sprite.width = 0.8 * this._pxWidth;
          sprite.height = 0.8 * this._pxWidth;
          sprite.position.x = 0.125 * sprite.width;
          sprite.position.y = 0.125 * sprite.height;
          return sprite;
        },

        isObjective: function () {
          return this._isObjective;
        },

        /**
         * @summary Reparents a sprite from one cell to other.
         */
        transferSprite: function (toCell) {
          if (this._sprite) {
            toCell._sprite = this._sprite;
            toCell._grObject.addChild(this._sprite);//removes from fromCell's container.
            this._sprite = null;
            toCell._sprite.position.x = 0.125 * toCell._sprite.width;
            toCell._sprite.position.y = 0.125 * toCell._sprite.height;

            var t = this._pieceTypeId;
            this._pieceTypeId = toCell._pieceTypeId;
            toCell._pieceTypeId = t;

            this._updateCell(false);
            toCell._updateCell(true);            
          }
        },

        /**
         * @summary Sets a cell as interactive.
         */
        enable: function (bEnable) {
          if (bEnable) {
            this._grObject.setInteractive(true);
            this._grObject.buttonMode = true;

            // Connect
            this._grObject.click = this._grObject.tap = this._onPositionSelected.bind(this);
          } else {
            this._grObject.setInteractive(false);
            this._grObject.buttonMode = false;

            // Dis-Connect
            this._grObject.mouseup = this._grObject.mouseupoutside = this._grObject.touchend = this._grObject.touchendoutside = null;
            this._grObject.mousedown = this._grObject.touchstart = null;
            this._grObject.click = this._grObject.tap = null;
          }
        },

        /**
         * @summary Implements the logic behind chess moves.
         */
        canMoveTo: function (row, col) {
          var dRows = row - this._row,
            dCols = col - this._col;

          if (this._pieceTypeId === 1) {// King
            if (Math.abs(dRows) <= 1 && Math.abs(dCols) <= 1) {
              return true;
            }
          } else if (this._pieceTypeId === 2) {// Queen
            if (dRows === 0 || dCols === 0 || Math.abs(dRows) === Math.abs(dCols)) {
              return true;
            }
          } else if (this._pieceTypeId === 3) {// Rook
            if (dRows === 0 || dCols === 0) {
              return true;
            }
          } else if (this._pieceTypeId === 4) {// Bishop
            if (Math.abs(dRows) === Math.abs(dCols)) {
              return true;
            }
          } else if (this._pieceTypeId === 5) {// Knight
            if ((Math.abs(dRows) === 1 && Math.abs(dCols) == 2) || (Math.abs(dRows) === 2 && Math.abs(dCols) == 1)) {
              return true;
            }
          } else if (this._pieceTypeId === 6) {// Pawn
          }
          return false;
        },

        /**
         * @summary Returns an array of cell positions that are capturable from this cell.
         */
        getCapturePositions: function (maxRow, maxCol) {
          var positions = [];
          positions.addPos = function (r, c) {
            if (0 <= r && r < maxRow && 0 <= c && c < maxCol) {
              this.push({
                row: r,
                col: c
              });
            }
          };

          var addRows = pzlpEngine2d.ChessRules.addRows,
            addCols = pzlpEngine2d.ChessRules.addCols,
            addDiagonals = pzlpEngine2d.ChessRules.addDiagonals;

          if (this._pieceTypeId === 1) {// King
            for (var i = -1; i < 2; i++) {
              for (var j = -1; j < 2; j++) {
                if (i === 0 && j === 0) {
                  continue;
                }
                positions.addPos(this._row + i, this._col + j);
              }
            }
          } else if (this._pieceTypeId === 2) {// Queen
            addRows(positions, this._matrix, this._row, this._col);
            addCols(positions, this._matrix, this._row, this._col);
            addDiagonals(positions, this._matrix, this._row, this._col);

          } else if (this._pieceTypeId === 3) {// Rook
            addRows(positions, this._matrix, this._row, this._col);
            addCols(positions, this._matrix, this._row, this._col);
          } else if (this._pieceTypeId === 4) {// Bishop
            addDiagonals(positions, this._matrix, this._row, this._col);

          } else if (this._pieceTypeId === 5) {// Knight

            positions.addPos(this._row + 1, this._col + 2);
            positions.addPos(this._row + 1, this._col - 2);
            positions.addPos(this._row - 1, this._col + 2);
            positions.addPos(this._row - 1, this._col - 2);
            positions.addPos(this._row + 2, this._col + 1);
            positions.addPos(this._row + 2, this._col - 1);
            positions.addPos(this._row - 2, this._col + 1);
            positions.addPos(this._row - 2, this._col - 1);

          } else if (this._pieceTypeId === 6) {// Pawn
            //TODO
          }
          return positions;
        },

        /**
         * @summary Inits action of movement
         */
        _onPositionSelected: function () {
          var cell = this._matrix.getCellAt(this._row, this._col);

          if (this._matrix.canMoveTo(this._row, this._col)) {
            if (cell.isCapturable()) {
              cell.pulseEnemies();
              return;
            }
            this._matrix.movePieceTo(this._row, this._col);
          } else {
            cell.pulseCell();
          }
        }

      });

      pzlpEngine2d.ChessCell = ChessCell;
    }());

    // ===============================================================================================
    // Chess Maze COMMAND
    (function () {
      var cmdMod_ = clientGameApp.module('command');

      /**
       * @summary Creates an instance of a command.
       * @param {object} data An object containing definition of command (id of cell, value and intention (clone/unclone)).
       */
      function ChessMazeCmd(data) {
        cmdMod_.Command.call(this, data);
      }
      ChessMazeCmd.constructor = ChessMazeCmd;
      ChessMazeCmd.prototype = Object.create(cmdMod_.Command.prototype);

      _.extend(ChessMazeCmd.prototype, {

        isUndoable: function () {
          return true;
        },
        isIdentity: function () {
          return false;
        },
        isOpposite: function (cmd) {
          return Math.abs(this._data.dRow + cmd._data.dRow) + Math.abs(this._data.dCol + cmd._data.dCol) === 0;
        },

        /**
         * @summary Creates a new command that is opposite the original (this).
         */
        getReversed: function () {
          return new ChessMazeCmd({
            pieceId: this._data.pieceId,
            dRow: -this._data.dRow,
            dCol: -this._data.dCol
          });
        }
      });

      pzlpEngine2d.ChessMazeCmd = ChessMazeCmd;
    }());

    // ===============================================================================================
    // CHESSBOARD MATRIX
    (function () {
      function ChessboardMatrix() {
        this._nRows = 0;
        this._nCols = 0;
        this._matrix = [];
        this._curPlayerPosition = null;
      }
      ChessboardMatrix.constructor = ChessboardMatrix;
      _.extend(ChessboardMatrix.prototype, {

        /**
         * @summary Initialize chessboard size.
         */
        setSize: function (nRows, nCols) {
          this._nRows = nRows;
          this._nCols = nCols;
        },

        getRows: function () {
          return this._nRows;
        },

        getCols: function () {
          return this._nCols;
        },

        /**
         * @summary Initialize player piece's postion.
         */
        setPlayerCell: function (row, col) {
          if (this._curPlayerPosition) {
            console.error("[ChessboardMatrix::setPlayerCell] initial player cell already set! Overwritting.");
          }

          this._curPlayerPosition = {
            row: row,
            col: col,
            cell: this.getCellAt(row, col)
          };
        },

        isSolved: function () {
          return this._curPlayerPosition && this._curPlayerPosition.cell.isObjective();
        },

        setCellAt: function (cell, row, col) {
          this._matrix[col + this._nCols * row] = cell;
        },

        getCellAt: function (row, col) {
          return this._matrix[col + this._nCols * row];
        },

        canMoveTo: function (row, col) {
          return this._curPlayerPosition.cell.canMoveTo(row, col);
        },

        movePieceTo: function (row, col) {
          this._nextPlayerPosition = {
            row: row,
            col: col,
            cell: this.getCellAt(row, col)
          };

          clientGameApp.startTransition();
          this._currentCmd = new pzlpEngine2d.ChessMazeCmd({
            pieceId: this._curPlayerPosition.cell.getPieceType(),
            dRow: this._nextPlayerPosition.row - this._curPlayerPosition.row,
            dCol: this._nextPlayerPosition.col - this._curPlayerPosition.col
          });

          this._onFinishPieceMov();
        },

        /**
         * @summary Moves the player by relative changes. Used for undo/redo.
         */
        movePieceRelative: function (dRow, dCol) {
          var row = this._curPlayerPosition.row + dRow,
            col = this._curPlayerPosition.col + dCol;

          this._nextPlayerPosition = {
            row: row,
            col: col,
            cell: this.getCellAt(row, col)
          };

          clientGameApp.startTransition();
          this._currentCmd = null;
          this._onFinishPieceMov();
        },

        /**
         * @summary Ends any unfinished movement of player's piece.
         */
        _onFinishPieceMov: function () {
          if (this._nextPlayerPosition) {
            var fromCell = this._curPlayerPosition.cell,
              toCell = this._nextPlayerPosition.cell;

            fromCell.transferSprite(toCell);

            this._curPlayerPosition = this._nextPlayerPosition;
            this._nextPlayerPosition = null;

            if (this._currentCmd) {
              clientGameApp.addCommand(this._currentCmd);
            }
            clientGameApp.endTransition();
          }
        },

        updateAnimations: function (timeStep) {
          for (var i = 0; i < this._nRows; i++) {
            for (var j = 0; j < this._nCols; j++) {
              var cell = this.getCellAt(i, j),
                animation = cell.getAnimation();

              if (animation && animation.isActive()) {
                animation.update(timeStep);
              }
            }
          }
        },

        /**
         * @summary Calculates what cells are in capture positions so that we don't need to
         *  calculate any more.
         */
        generateCaptureMap: function () {
          for (var i = 0; i < this._nRows; i++) {
            for (var j = 0; j < this._nCols; j++) {
              var cell = this.getCellAt(i, j),
                pieceTypeId = cell.getPieceType();

              if (cell.hasOpponentPiece()) {
                var positions = cell.getCapturePositions(this._nRows, this._nCols);
                for (var k = 0, n = positions.length; k < n; k++) {
                  var p = positions[k],
                    row = p.row,
                    col = p.col,
                    cap = this.getCellAt(row, col);

                  cap.addCapturedBy(cell);
                }
              }
            }
          }
        }
      });

      pzlpEngine2d.ChessboardMatrix = ChessboardMatrix;
    }());


    // ===============================================================================================
    // ===============================================================================================
    // ===============================================================================================

    var gameObjects = {
      gridLayer: null
    };

    /**
     * @summary Loads a level (always exists at least one), building the scene and the like.
     *
     * @param {callback} callback Once completed the job, call this function in order to continue.
     * @param {object} level An object describing current level.
     * @param {object} env Environment object, containing world object to attach scene objects.
     * @param {callback} progressUpdate Function that enables client to update the progress (0=>0%, 1=>100%)
     */
    clientGameApp.loadLevel = function (callback, level, env, progressUpdate) {
      var PIXI = pzlpEngine2d.PIXI;

      // Precalc level values
      var gameDescription = clientGameApp.gameDescription,
        machine = gameDescription.machine;

      gameObjects.optimalValue = machine ? parseInt(machine.optimal, 10) : undefined;

      this._gameObjects = {};

      // // Require sounds...
      // clientGameApp.requireSounds([{
      //   name: 'ui_sound094',
      //   path: '/puzzles/cloning'
      // }, {
      //   name: 'ui_sound095',
      //   path: '/puzzles/cloning'
      // }, {
      //   name: 'ui_sound096',
      //   path: '/puzzles/cloning'
      // }, {
      //   name: 'ui_sound0114',
      //   path: '/puzzles/cloning'
      // }]);

      clientGameApp.requireMusic([{
        name: 'evilmind_choose_the_right_one',
        path: '/music/evilmind'
      }]);

      // After initializing viewport, we can init the player background texture:
      gameObjects.background = new pzlpEngine2d.Background('' + COLOR_PALETTE.shadow);

      var PIXI = pzlpEngine2d.PIXI,
        camera = env.getCamera();

      // Params
      var cellSize = 1,
        frameMarginX = 1,
        frameMarginY = 1;

      // Board size
      var ROWS = 8,
        COLS = 8;

      var frameWidth = COLS * cellSize + 2 * frameMarginX,
        frameHeight = ROWS * cellSize + 2 * frameMarginY;

      //camera._debug = true;
      camera.setVFactor(1);
      camera.setViewport(-frameWidth/2, frameWidth/2, -frameHeight/2, frameHeight/2);

      // Load resources
      var spritesheet = pzlpEngine2d.ResourceLib.getSpriteSheetPathName('peter-karpov/chess-mazes');

      // Load resources
      var loader = new PIXI.AssetLoader([spritesheet]);
      loader.onComplete = function () {
        progressUpdate(0.35);

        var frameContainer = new PIXI.DisplayObjectContainer();
        camera.addChildAt(frameContainer, 0);

        var camSize = camera.getCamSize(),
          lengthToPixels = camera.lengthToPixels.bind(camera),
          pxWidth = lengthToPixels(cellSize),
          pxHeight = lengthToPixels(cellSize),
          pxMarginX = lengthToPixels(frameMarginX),
          pxMarginY = lengthToPixels(frameMarginY);

        var i, j;

        // Add background cells:
        var chessMatrix = new pzlpEngine2d.ChessboardMatrix();
        chessMatrix.setSize(ROWS, COLS);
        
        for (i = 0; i < ROWS; i++) {
          for (j = 0; j < COLS; j++) {
            var c = new pzlpEngine2d.ChessCell();
            c.init(chessMatrix, i, j, frameContainer, pxMarginX + pxWidth * j, pxMarginY + pxHeight * i, pxWidth, pxHeight);
            chessMatrix.setCellAt(c, i, j);

            if (initialChessState[i][j] === CHESS_MAZE_OBJECTIVE_ID) {
              c.setObjectiveCell();
            } else if (initialChessState[i][j] < 0) {
              c.setOpponentPiece(-initialChessState[i][j], getPieceSprite(initialChessState[i][j]));
            } else if (initialChessState[i][j] > 0) {
              c.setPlayerPiece(initialChessState[i][j], getPieceSprite(initialChessState[i][j]));
              chessMatrix.setPlayerCell(i, j);
            }
          }
        }

        // Once we've positioned pieces, we can precalculate the capture map:
        chessMatrix.generateCaptureMap();

        clientGameApp._gameObjects.chessMatrix = chessMatrix;

        clientGameApp.getPiece = function (pieceId) {
          return clientGameApp._gameObjects._piecesById[pieceId];
        };

        // Ended!
        progressUpdate(0.95);
        callback({});

      };
      loader.load();
      progressUpdate(0.1);
      
    };

    /**
     * @summary Process undo/redo from command machine:
     */
    clientGameApp.movePiece = function (cmd, callback) {
      var cmdData = cmd.getData(),
        dRow = cmdData.dRow,
        dCol = cmdData.dCol;

      this._gameObjects.chessMatrix.movePieceRelative(dRow, dCol);

      if (callback) {
        callback(true);
      }
    };

    /**
     * @summary Main game loop.
     */
    clientGameApp.gameUpdate = function (step, time) {

      // Animations
      this._gameObjects.chessMatrix.updateAnimations(time);

      // Winning condition
      var solved = this._gameObjects.chessMatrix.isSolved();

      // If solved, end the game.
      if (solved) {
        var cmdList = clientGameApp.getCmdList();
        clientGameApp.gameOver({
          solved: true,
          solution: cmdList
        });
      }
    };
  }


}(window.puzzlePlayer));