(function (puzzlePlayer) {
  'use strict';

  var webRoot = PAGE_DATA.SYS.webRoot;

  puzzlePlayer.loadPuzzle({
    pid: "%THIS_CONTENT_PID%",
    structure: webRoot + '/../data/contents/puzzles/%THIS_CONTENT_URI%/deploy/descriptor.min.json',
    clientBuildGame: buildGame
  });

  /**
   * @summary Function called when there exists an instance of the game.
   */
  function buildGame(clientGameApp) {

    // ===============================================================================================
    // A new type of sliding block puzzle piece: one that has special move restrictions. This is necessary
    // in order to establish a new kind of dragMovement.
    (function (exports, PIXI) {
      
      function WallDecorator() {
        PIXI.DisplayObjectContainer.call(this);

        this._layer = null;
      }
      WallDecorator.constructor = WallDecorator;
      WallDecorator.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);

      _.extend(WallDecorator.prototype, {

        attachToLayer: function (layer, fromPos, isVertical) {
          if (!this._layer) {
            this._layer = layer;
            this._layer.addInternalWall(this, fromPos, isVertical);

            // Manage zindex in avobe-pieces elements
            exports.zIndexed.addZIndexMod(this);
            this.setZIndex(1);

            // Visualization of the wall
            this._graphics = new PIXI.Graphics();
            this.addChild(this._graphics);
            this._graphics.lineStyle(3, 0xFF9F1C, 1);

            var toPos = {
              col: fromPos.col,
              row: fromPos.row
            };
            if (isVertical) {
              toPos.row += 1;
            } else {
              toPos.col += 1;
            }

            var sttPos = layer.toPixels(fromPos),
              endPos = layer.toPixels(toPos);

            //this._graphics.drawRect(0, 0, endPos.x - sttPos.x, endPos.y - sttPos.y);
            this._graphics.moveTo(-1, -1);
            this._graphics.lineTo(endPos.x - sttPos.x - 1, endPos.y - sttPos.y - 1);

            this._graphics.position.x = sttPos.x;
            this._graphics.position.y = sttPos.y;

            layer.addAboveShape(this);
            layer.sortByZIndex();
          }
        },

        hitWall: function () {
          //console.log("Wall hitted!");
        }
      });

      exports.WallDecorator = WallDecorator;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));


    // ===============================================================================================
    // A new type of sliding block puzzle piece: one that has special move restrictions. This is necessary
    // in order to establish a new kind of dragMovement.
    (function (exports) {
      
      function SBPWallConstrained() {
        exports.SlidingBlockPiece.apply(this, arguments);
      }
      SBPWallConstrained.constructor = SBPWallConstrained;

      // Extend from PlanarPiece
      _.extend(SBPWallConstrained.prototype, exports.SlidingBlockPiece.prototype);

      // Specialize
      _.extend(SBPWallConstrained.prototype, {

        /**
         * @summary We only need to specialize the kind of dragger!
         */
        createDragger: function () {
          return new exports.SBPWallDragMov(this._gridLayer, this);
        }
      });

      // Finally publish API:
      exports.SBPWallConstrained = SBPWallConstrained;
    }(pzlpEngine2d));

    // ===============================================================================================
    // Extend grid layer to support internal walls.
    (function (exports) {

      _.extend(pzlpEngine2d.RectGridLayer.prototype, {

        /**
         * sttCellPos = {row: 0, col:0 } means we are creating a wall at the top-left origin! This would have no
         *  effect since this is already the layer limit.
         */
        addInternalWall: function (wallObject, sttCellPos, isVertical) {
          if (!this._internalWalls) {
            this._internalWalls = [];
          }

          var posIdx = sttCellPos.col + this._gridNumCols * sttCellPos.row;
          if (!this._internalWalls[posIdx]) {
            this._internalWalls[posIdx] = {
              h: 0,
              v: 0
            };
          }

          if (isVertical) {
            this._internalWalls[posIdx].v = wallObject;
          } else {
            this._internalWalls[posIdx].h = wallObject;
          }

        },

        /**
         * @summary Returns true if there exists a vertical wall from cell (row, col) to (row, col + dCol)
         */
        existsVerticalWall: function (row, col, dCol) {
          if (!this._internalWalls) {
            return false;
          }
          var posIdx = 0;
          if (dCol === 1 || dCol === -1) {
            posIdx = col + (dCol === 1 ? 1 : 0) + this._gridNumCols * row;
          }
          if (this._internalWalls[posIdx] && this._internalWalls[posIdx].v) {
            this._internalWalls[posIdx].v.hitWall();
            return true;
          }
          return false;
        },

        /**
         * @summary Returns true if there exists an horizontal wall from cell (row, col) to (row + dRow, col)
         */
        existsHorizontalWall: function (row, col, dRow) {
          if (!this._internalWalls) {
            return false;
          }
          var posIdx = 0;
          if (dRow === 1 || dRow === -1) {
            posIdx = col + this._gridNumCols * (row + (dRow === 1 ? 1 : 0));
          }
          if (this._internalWalls[posIdx] && this._internalWalls[posIdx].h) {
            this._internalWalls[posIdx].h.hitWall();
            return true;
          }
          return false;
        }

      });
    }(pzlpEngine2d));

    // ===============================================================================================
    // A drag movement object that is aware of possible internal walls.
    (function (exports) {
      
      function SBPWallDragMov() {
        exports.DragMovement.apply(this, arguments);
      }
      SBPWallDragMov.constructor = SBPWallDragMov;

      // Extend from PlanarPiece
      _.extend(SBPWallDragMov.prototype, exports.DragMovement.prototype);

      // Specialize
      _.extend(SBPWallDragMov.prototype, {
          
        /**
         * @summary Checks for collisions. If so, then modifies dx until it is valid or 0.
         */
        filterMovX: function (dx) {
          var cells = this._piece.getGridCells(),
            nCells = cells.length,
            gridPos = this._piece.getPosition(),
            i,
            cell;

          if (dx > 0) {

            // Move to the right!
            for (i = 0; i < nCells; i++) {
              cell = cells[i];

              // Only process bound cells (without neighbours in mov direction)
              if (!cell.neighbours.right) {

                // Check for wall first in order to fire hit wall events
                if (this._gridLayer.existsVerticalWall(gridPos.row + cell.row, gridPos.col + cell.col, 1)) {
                  return 0;
                }

                // If adjacent position is not free then filter x
                if (!this._gridLayer.isFreeCell(gridPos.row + cell.row, gridPos.col + cell.col + 1)) {
                  return 0;
                }
              }
            }
          } else if (dx < 0) {

            // Move to the left!
            for (i = 0; i < nCells; i++) {
              cell = cells[i];

              // Only process bound cells (without neighbours in mov direction)
              if (!cell.neighbours.left) {

                // Check for wall first in order to fire hit wall events
                if (this._gridLayer.existsVerticalWall(gridPos.row + cell.row, gridPos.col + cell.col, -1)) {
                  return 0;
                }

                // If adjacent position is not free then filter x
                if (!this._gridLayer.isFreeCell(gridPos.row + cell.row, gridPos.col + cell.col - 1)) {
                  return 0;
                }
              }
            }
          }
          return dx;
        },

        /**
         * @summary Checks for collisions. If so, then modifies dy until it is valid or 0.
         */
        filterMovY: function (dy) {
          var cells = this._piece.getGridCells(),
            nCells = cells.length,
            gridPos = this._piece.getPosition(),
            i,
            cell;

          if (dy > 0) {

            // Move to the right!
            for (i = 0; i < nCells; i++) {
              cell = cells[i];

              // Only process bound cells (without neighbours in mov direction)
              if (!cell.neighbours.top) {

                // Check for wall first in order to fire hit wall events
                if (this._gridLayer.existsHorizontalWall(gridPos.row + cell.row, gridPos.col + cell.col, -1)) {
                  return 0;
                }

                // If adjacent position is not free then filter y
                if (!this._gridLayer.isFreeCell(gridPos.row + cell.row - 1, gridPos.col + cell.col)) {
                  return 0;
                }
              }
            }
          } else if (dy < 0) {

            // Move to the left!
            for (i = 0; i < nCells; i++) {
              cell = cells[i];

              // Only process bound cells (without neighbours in mov direction)
              if (!cell.neighbours.bottom) {

                // Check for wall first in order to fire hit wall events
                if (this._gridLayer.existsHorizontalWall(gridPos.row + cell.row, gridPos.col + cell.col, 1)) {
                  return 0;
                }

                // If adjacent position is not free then filter y
                if (!this._gridLayer.isFreeCell(gridPos.row + cell.row + 1, gridPos.col + cell.col)) {
                  return 0;
                }
              }
            }
          }
          return dy;
        }
      });

      // Finally publish API:
      exports.SBPWallDragMov = SBPWallDragMov;
    }(pzlpEngine2d));

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

      // Require sounds...
      clientGameApp.requireSounds([{
        name: 'piece_drag_3',
        path: '/pieces'
      }]);

      // Puzzle frame definition
      var frame = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 0]
      ];

      var nRows = frame.length,
        nCols = frame[0].length,
        cellSize = 1;

      var layerPosition = pzlpEngine2d.GameBuildHelper.initViewportFromFrame({
        frame: frame,
        margin: 0.2
      });

      // After initializing viewport, we can init the player background texture:
      //gameObjects.background = new pzlpEngine2d.Background(pzlpEngine2d.ResourceLib.getPlayerBackgroundName(3));
      gameObjects.background = new pzlpEngine2d.Background('0x011627');


      // Load resources
      var loader = new PIXI.AssetLoader([pzlpEngine2d.ResourceLib.getSpriteSheetPathName('alexey-nigin/set-1')]);
      loader.onComplete = function () {
        progressUpdate(0.35);

        // Frame
        var frameBorder2 = 0.35;
        var layerFrame = new pzlpEngine2d.GridPlanarShape();

        layerFrame.define({x: 0, y: 0}, (1 + 0.4 * frameBorder2) * cellSize, pzlpEngine2d.Grid.createRectangleShape(nCols, nRows));
        layerFrame.forceCalcMask();        
        layerFrame.setTextureFromFile(pzlpEngine2d.ResourceLib.getTextureName3('textures/effects', 'empty.png'));
        layerFrame.setWorldPos({x: (layerPosition.x - frameBorder2), y: (layerPosition.y + frameBorder2)});

        // Logic-game layer
        var gridLayer = new pzlpEngine2d.RectGridLayer('main-layer', layerPosition.x, layerPosition.y, nCols, nRows, cellSize);
        gameObjects.gridLayer = gridLayer;

        //pzlpEngine2d.G15BlocksLogic.generateInitialState(frame, 600);

        gridLayer.buildFromFrame({
          frame: frame,
          frameOptions: {
            textureFromFile: pzlpEngine2d.ResourceLib.getTextureName3('textures/effects', 'empty.png')
          },
          pieceOptions: {
            draggable: true,
            textureGroups: {
              'c1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              'c2': [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
            },
            pieceCreator: function (pieceId) {
              return new pzlpEngine2d.SBPWallConstrained(pieceId);
            }
          }
        });

        // Connect sounds
        pzlpEngine2d.GameBuildHelper.connectSounds(function (id) {
          return gridLayer.getPiece(id);
        }, {
          'dragging': {
            'piece_drag_3': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
          }
        });

        // Add the walls
        var walls = [];
        walls[0] = new pzlpEngine2d.WallDecorator();
        walls[0].attachToLayer(gridLayer, {row: 1, col: 1}, true);

        walls[1] = new pzlpEngine2d.WallDecorator();
        walls[1].attachToLayer(gridLayer, {row: 1, col: 1}, false);

        walls[2] = new pzlpEngine2d.WallDecorator();
        walls[2].attachToLayer(gridLayer, {row: 1, col: 4}, true);

        walls[3] = new pzlpEngine2d.WallDecorator();
        walls[3].attachToLayer(gridLayer, {row: 1, col: 3}, false);

        walls[4] = new pzlpEngine2d.WallDecorator();
        walls[4].attachToLayer(gridLayer, {row: 3, col: 1}, true);

        walls[5] = new pzlpEngine2d.WallDecorator();
        walls[5].attachToLayer(gridLayer, {row: 4, col: 1}, false);

        walls[6] = new pzlpEngine2d.WallDecorator();
        walls[6].attachToLayer(gridLayer, {row: 3, col: 4}, true);

        walls[7] = new pzlpEngine2d.WallDecorator();
        walls[7].attachToLayer(gridLayer, {row: 4, col: 3}, false);

        clientGameApp.gameObjects_ = gameObjects;

        // Ended!
        progressUpdate(0.95);
        callback({});

      };
      loader.load();
      progressUpdate(0.1);
      
    };

    /**
     * @summary Returns true if the piece is at the bottom-left shape of the grid.
     */
    clientGameApp.isPieceAtBottom = function (pieceId) {
      var pos = this.gameObjects_.gridLayer.getPiecePos(pieceId);

      if (pos.row < 2) {
        return false;
      }
      if (pos.row == 2 && pos.col < 2) {
        return false;
      }
      return true;
    };

    /**
     * @summary Game's main loop.
     */
    clientGameApp.gameUpdate = function (step, time) {

      // Check if solved
      var solved = true;
      for (var i = 1; i < 13; i++) {
        if (!this.isPieceAtBottom(i)) {
          solved = false;
          break;
        }
      }
      
      //Check that central cell is empty
      if (solved && !this.gameObjects_.gridLayer.isFreeCell(2, 2)) {
        solved = false;
      }

      // If solved, end game!
      if (solved) {
        var cmdList = clientGameApp.getCmdList(),
          numSteps = cmdList ? cmdList.length : 0,
          optSteps = gameObjects.optimalValue !== undefined ? gameObjects.optimalValue : 0;

        clientGameApp.gameOver({
          solved: true,
          solution: cmdList,
          performance: Math.floor(10 * ((2 * optSteps) / (optSteps + numSteps)))
        });
      }
    };
  }


}(window.puzzlePlayer));