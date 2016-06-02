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
    // Animation objects
    (function (exports, PIXI) {
      
      // Container of animations, and export the update function.
      exports._allAnimations = [];
      exports.updateAnimations = function (timeStep) {
        _.each(exports._allAnimations, function (animation) {
          if (animation && animation.isActive()) {
            animation.update(timeStep);
          }
        });
      };

      /**
       * @summary Implements a pulse animation
       */
      function Animation(pxWidth, pxHeight, color, type, maxAlpha) {
        exports.Decorator.apply(this, arguments);
        PIXI.DisplayObjectContainer.call(this);

        this._pxWidth = pxWidth;
        this._pxHeight = pxHeight;
        this._grObject = new PIXI.Graphics();
        this.addChild(this._grObject);
        
        this._color = color ? color : 0xFFFFFF;
        this._maxAlpha = maxAlpha ? maxAlpha : 1;
        this._active = false;
        this._isStatic = type === 'static';
        this._isCircular = type === 'circular';

        // Time in milliseconds
        this._timeOffset = 0;
        this._expansionDuration = 600;
        this._sleepDuration = 2000;
        this._totalDuration = this._expansionDuration + this._sleepDuration;

        this._cx = this._pxWidth / 2;
        this._cy = this._pxHeight / 2;

        this._toBeFinished = false;
        this._interrumpible = false;

        exports._allAnimations.push(this);
      }
      Animation.constructor = Animation;

      Animation.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
      _.extend(Animation.prototype, exports.Decorator.prototype);
      _.extend(Animation.prototype, {

        attachToShape: function (layer, shape) {
          shape.addDecorator(this);
          layer.addAboveShape(this);
        },

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
         * @summary Starts the animation but also marks it to be finished, so only 1 cycle is animated.
         */
        pulse: function () {
          if (this._interrumpible || !this._active) {
            this._active = true;
            this._toBeFinished = true;
            this._timeOffset = 0;
          }
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
              dW = this._isStatic ? 0.5 * this._pxWidth : 0.48 * this._pxWidth * pctr2,
              dH = this._isStatic ? 0.5 * this._pxHeight : 0.48 * this._pxHeight * pctr2;

            this._grObject.beginFill(this._color, this._maxAlpha * (1 - pctr2));

            if (this._isCircular) {
              this._grObject.drawCircle(this._cx, this._cy, dW);
            } else {
              this._grObject.drawRect(this._cx - dW, this._cy - dH, 2 * dW, 2 * dH);
            }
          } else if (this._toBeFinished) {
            this._active = false;
            this._toBeFinished = false;
          }
        }
      });

      exports.Animation = Animation;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));

    // ===============================================================================================
    // The wall object decorator, adds info to the grid layer and has its own visualization.
    (function (exports, PIXI) {
      
      function WallDecorator(color, colorHit, texName, pxWidth, pxHeight) {
        PIXI.DisplayObjectContainer.call(this);

        this._layer = null;
        this._texName = texName;
        this._pxWidth = pxWidth;
        this._pxHeight = pxHeight;
        this._color = color;
        this._colorHit = colorHit;
        this._animation = null;
      }
      WallDecorator.constructor = WallDecorator;
      WallDecorator.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);

      _.extend(WallDecorator.prototype, {

        /**
         * @summary Adds the wall definition to the grid layer and initializes visualization.
         */
        attachToLayer: function (layer, fromPos, isVertical) {
          if (!this._layer) {
            this._layer = layer;
            this._layer.addInternalWall(this, fromPos, isVertical);

            // Manage zindex in avobe-pieces elements
            exports.zIndexed.addZIndexMod(this);
            this.setZIndex(1);

            // Calc position of wall
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

            if (this._texName) {
              this._sprite = pzlpEngine2d.PIXI.Sprite.fromFrame(this._texName);
              this._sprite.width = this._pxWidth;
              this._sprite.height = this._pxHeight;
              if (isVertical) {
                this._sprite.position.x = sttPos.x - 3;
                this._sprite.position.y = sttPos.y + 3;
              } else {
                this._sprite.anchor.x = 0.5;
                this._sprite.anchor.y = 0.5;
                this._sprite.rotation = Math.PI / 2;
                this._sprite.position.x = sttPos.x + 0.5 * this._sprite.width;
                this._sprite.position.y = sttPos.y + 0.5 * this._sprite.height;
              }
              
              this._sprite.tint = 0x000000;
              this.addChild(this._sprite);
            } else {
              // Visualization of the wall
              this._graphics = new PIXI.Graphics();
              this.addChild(this._graphics);
              this._graphics.lineStyle(3, this._color, 1);

              this._graphics.moveTo(-1, -1);
              this._graphics.lineTo(endPos.x - sttPos.x - 1, endPos.y - sttPos.y - 1);

              this._graphics.position.x = sttPos.x;
              this._graphics.position.y = sttPos.y;

              var sizeX = 0,
                sizeY = 0;
              if (isVertical) {
                sizeY = endPos.y - sttPos.y;
                sizeX = 0.2 * sizeY;
              } else {
                sizeX = endPos.x - sttPos.x;
                sizeY = 0.2 * sizeX;
              }
              this._animation = new exports.Animation(sizeX, sizeY, this._colorHit);
              this._animation.position.x = sttPos.x - 0.5 * (isVertical ? sizeX : 0);
              this._animation.position.y = sttPos.y - 0.5 * (isVertical ? 0 : sizeY);
              this.addChild(this._animation);
            }

            layer.addAboveShape(this);
            layer.sortByZIndex();
          }
        },

        /**
         * @summary Effect when wall is hitted.
         */
        hitWall: function () {
          if (this._animation) {
            this._animation.pulse();
          }
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

        this._animation = null;
      }
      SBPWallConstrained.constructor = SBPWallConstrained;

      // Extend from SlidingBlockPiece
      _.extend(SBPWallConstrained.prototype, exports.SlidingBlockPiece.prototype);

      // Specialize
      _.extend(SBPWallConstrained.prototype, {

        /**
         * @summary We only need to specialize the kind of dragger!
         */
        createDragger: function () {
          var dragger = new exports.SBPWallDragMov(this._gridLayer, this);

          if (!this._animation) {
            var boxSize = this.getRealBoxSize(),
              camera = exports.getEnvironment().getCamera(),
              pxWidth = camera.lengthToPixels(boxSize.w),
              pxHeight = camera.lengthToPixels(boxSize.h);

            this._animation = new exports.Animation(pxWidth, pxHeight, 0xFFFFFF, 'circular', 0.75);
            this._animation.attachToShape(this._gridLayer, this.getShape());
          }
          dragger.setAnimation(this._animation);
          return dragger;
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

          this._WALL_HIT_THRESHOLD = 1;
        },

        /**
         * @summary Returns true if there exists a vertical wall from cell (row, col) to (row, col + dCol)
         */
        existsVerticalWall: function (dx, row, col, dCol) {
          if (!this._internalWalls) {
            return false;
          }
          var posIdx = 0;
          if (dCol === 1 || dCol === -1) {
            posIdx = col + (dCol === 1 ? 1 : 0) + this._gridNumCols * row;
          }
          if (this._internalWalls[posIdx] && this._internalWalls[posIdx].v) {
            if (Math.abs(dx) > this._WALL_HIT_THRESHOLD) {
              this._internalWalls[posIdx].v.hitWall();
            }
            return true;
          }
          return false;
        },

        /**
         * @summary Returns true if there exists an horizontal wall from cell (row, col) to (row + dRow, col)
         */
        existsHorizontalWall: function (dy, row, col, dRow) {
          if (!this._internalWalls) {
            return false;
          }
          var posIdx = 0;
          if (dRow === 1 || dRow === -1) {
            posIdx = col + this._gridNumCols * (row + (dRow === 1 ? 1 : 0));
          }
          if (this._internalWalls[posIdx] && this._internalWalls[posIdx].h) {
            if (Math.abs(dy) > this._WALL_HIT_THRESHOLD) {
              this._internalWalls[posIdx].h.hitWall();
            }
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

        this._animation = null;
      }
      SBPWallDragMov.constructor = SBPWallDragMov;

      // Extend from DragMovement
      _.extend(SBPWallDragMov.prototype, exports.DragMovement.prototype);

      // Specialize
      _.extend(SBPWallDragMov.prototype, {
      
        setAnimation: function (a) {
          this._animation = a;
        },

        /**
         * @summary Overwrite in order to add an animation.
         */    
        startMovement: function () {
          this.gameApp_.startTransition();

          if (this._animation) {
            this._animation.pulse();
          }
        },

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
                if (this._gridLayer.existsVerticalWall(dx, gridPos.row + cell.row, gridPos.col + cell.col, 1)) {
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
                if (this._gridLayer.existsVerticalWall(dx, gridPos.row + cell.row, gridPos.col + cell.col, -1)) {
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
                if (this._gridLayer.existsHorizontalWall(dy, gridPos.row + cell.row, gridPos.col + cell.col, -1)) {
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
                if (this._gridLayer.existsHorizontalWall(dy, gridPos.row + cell.row, gridPos.col + cell.col, 1)) {
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
        // [1, 2, 3, 4, 5],
        // [6, 7, 8, 9, 10],
        // [11, 12, 13, 14, 15],
        // [16, 17, 18, 19, 20],
        // [21, 22, 23, 24, 0]
        [1, 6, 11, 15, 20],
        [2, 7, 12, 16, 21],
        [3, 8, 0, 17, 22],
        [4, 9, 13, 18, 23],
        [5, 10, 14, 19, 24]
      ];

      var nRows = frame.length,
        nCols = frame[0].length,
        cellSize = 1;

      var layerPosition = pzlpEngine2d.GameBuildHelper.initViewportFromFrame({
        frame: frame,
        margin: 0.2
      });

      // After initializing viewport, we can init the player background texture:
      gameObjects.background = new pzlpEngine2d.Background('0xFFFFFF');


      // Load resources
      var loader = new PIXI.AssetLoader([pzlpEngine2d.ResourceLib.getSpriteSheetPathName('alexey-nigin/set-soldiers')]);
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

        // Initial mixing of pieces
        pzlpEngine2d.G15BlocksLogic.generateInitialState(frame, 600);

        gridLayer.buildFromFrame({
          frame: frame,
          frameOptions: {
            textureFromFile: pzlpEngine2d.ResourceLib.getTextureName3('textures/effects', 'empty.png')
          },
          pieceOptions: {
            draggable: true,
            textureGroups: {
              '1_1': [1],
              '1_2': [2],
              '1_3': [3],
              '1_4': [4],
              '1_5': [5],
              '2_1': [6],
              '2_2': [7],
              '2_3': [8],
              '2_4': [9],
              '2_5': [10],
              '3_1': [11],
              '3_2': [12],
              '3_4': [13],
              '3_5': [14],
              '4_1': [15],
              '4_2': [16],
              '4_3': [17],
              '4_4': [18],
              '4_5': [19],
              '5_1': [20],
              '5_2': [21],
              '5_3': [22],
              '5_4': [23],
              '5_5': [24]
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

        clientGameApp.requireMusic([{
          name: 'ambient-2',
          path: '/music/wowsoundsg'
        }]);

        // Add the walls
        var walls = [];

        walls[0] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[0].attachToLayer(gridLayer, {row: 1, col: 1}, true);

        walls[1] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[1].attachToLayer(gridLayer, {row: 1, col: 1}, false);

        walls[2] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[2].attachToLayer(gridLayer, {row: 1, col: 4}, true);

        walls[3] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[3].attachToLayer(gridLayer, {row: 1, col: 3}, false);

        walls[4] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[4].attachToLayer(gridLayer, {row: 3, col: 1}, true);

        walls[5] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[5].attachToLayer(gridLayer, {row: 4, col: 1}, false);

        walls[6] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[6].attachToLayer(gridLayer, {row: 3, col: 4}, true);

        walls[7] = new pzlpEngine2d.WallDecorator(0x011627, 0xFF9F1C);
        walls[7].attachToLayer(gridLayer, {row: 4, col: 3}, false);

        // Connect animations
        clientGameApp.updateAnimations = pzlpEngine2d.updateAnimations;

        // Ended!
        progressUpdate(0.95);
        callback({});

      };
      loader.load();
      progressUpdate(0.1);
    };

    clientGameApp.gameUpdate = function (step, time) {

      // Updates
      this.updateAnimations(time);

      // Check if puzzle is solved:
      var objective = [
        [1, 6, 11, 15, 20],
        [2, 7, 12, 16, 21],
        [3, 8, 0, 17, 22],
        [4, 9, 13, 18, 23],
        [5, 10, 14, 19, 24]
        // [1, 2, 3, 4, 5],
        // [6, 7, 8, 9, 10],
        // [11, 12, 0, 13, 14],
        // [15, 16, 17, 18, 19],
        // [20, 21, 22, 23, 24]
      ];

      if (gameObjects.gridLayer.arePiecesAt(objective)) {
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