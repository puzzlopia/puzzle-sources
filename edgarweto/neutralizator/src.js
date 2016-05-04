(function (puzzlePlayer) {
  'use strict';

  var webRoot = PAGE_DATA.SYS.webRoot;

  puzzlePlayer.loadPuzzle({
    pid: "%THIS_CONTENT_PID%",
    structure: webRoot + '/../data/contents/puzzles/%THIS_CONTENT_URI%/deploy/descriptor.min.json',
    clientBuildGame: buildGame
  });

  /** @const */
  var SOUND_FUSION_VOLUME = 0.8;

  /**
   * @summary Function called when there exists an instance of the game.
   */
  function buildGame(clientGameApp) {

    // ===============================================================================================
    // NEUTRALIZATOR COMMAND
    (function () {
      var cmdMod_ = clientGameApp.module('command');

      /**
       * @summary Creates an instance of a command.
       * data is an object containing value before the command, id of cell and intention (clone/unclone).
       */
      function NeutralizatorCmd(data) {
        cmdMod_.Command.call(this, data);

        /** @const */
        this.OPPOSITE_EPSILON = 0.001;
      }
      NeutralizatorCmd.constructor = NeutralizatorCmd;
      NeutralizatorCmd.prototype = Object.create(cmdMod_.Command.prototype);

      _.extend(NeutralizatorCmd.prototype, {

        isUndoable: function () {
          return true;
        },
        isIdentity: function () {
          return false;
        },
        isOpposite: function (cmd) {
          return false;
        },

        /**
         * @summary Creates a new command that is opposite the original.
         */
        getReversed: function () {
          return new NeutralizatorCmd({
            value: this._data.value,
            pieceId: this._data.pieceId,
            intentClone: !this._data.intentClone
          });
        }
      });

      pzlpEngine2d.NeutralizatorCmd = NeutralizatorCmd;
    }());

    // ===============================================================================================
    // CELL CLASS
    (function () {

      /**
       * @summary ReplicantAnimation
       */
      function ReplicantAnimation(parent, pxX, pxY, pxWidth, pxHeight) {
        this._pxX = pxX;
        this._pxY = pxY;
        this._pxWidth = pxWidth;
        this._pxHeight = pxHeight;

        this._sprites = [];
        this._animationStep = 0;
        this._MAX_STEPS = 10;

        this._grParent = parent;
      }
      ReplicantAnimation.constructor = ReplicantAnimation;
        
      _.extend(ReplicantAnimation.prototype, {

        /**
         * @summary: adds an adjacent cell as a destination of a temporal sprite given by type 'value'.
         */
        addCell: function (cell, sprite, onEnd) {
          var destObject = cell.getShape(),
            destX = destObject.x,
            destY = destObject.y,
            incrX = (destX - this._grParent.x) / this._MAX_STEPS,
            incrY = (destY - this._grParent.y) / this._MAX_STEPS;

          this._sprites.push({
            sprite: sprite,
            destX: destX,
            destY: destY,
            incrX: incrX,
            incrY: incrY,
            onEnd: onEnd
          });

          this._grParent.addChild(sprite);
        },

        /**
         * @summary Updates the animation.
         */
        animate: function (time) {
          this._animationStep++;
          if (this._animationStep < this._MAX_STEPS) {
            _.each(this._sprites, function (u) {//DEPENDS ON DEVICE PERFORMANCE!!!!!
              u.sprite.x += u.incrX;
              u.sprite.y += u.incrY;
            });
          } else {
            this.finish();
          }
        },

        /**
         * @summary Finishes the animation.
         */
        finish: function () {
          var parent = this._grParent;
          _.each(this._sprites, function (u) {
            parent.removeChild(u.sprite);
            if (u.onEnd) {
              u.onEnd();
            }
          });

          if (this._onFinished) {
            this._onFinished();
            this._onFinished = null;
          }
        },

        /**
         * @summary Sets the callback function to be called when the animation ends.
         */
        onFinish: function (callback) {
          this._onFinished = callback;
        }

      });

      /**
       * @summary AnnihilationAnimation
       */
      function AnnihilationAnimation(cell) {

        this._animationStep = 0;
        this._MAX_STEPS = 20;

        this._rings = null;
        this._grParent = cell.getShape();
        this._pxMaxRadius = 0.5 * cell._pxWidth;

        this._init();
      }
      AnnihilationAnimation.constructor = AnnihilationAnimation;
        
      _.extend(AnnihilationAnimation.prototype, {

        /**
         * @summary: adds an adjacent cell as a destination of a temporal sprite given by type 'value'.
         */
        _init: function () {
          this._rings = [];
          this._rings[0] = new pzlpEngine2d.PIXI.Graphics();
          this._rings[0].lineStyle(3, 0xFF9F1C, 1);
          this._rings[0].drawCircle(this._pxMaxRadius, this._pxMaxRadius, 0);          
          this._rings[0].blendMode = pzlpEngine2d.PIXI.blendModes.SCREEN;

          this._rings[1] = new pzlpEngine2d.PIXI.Graphics();
          this._rings[1].lineStyle(3, 0xFF9F1C, 1);
          this._rings[1].drawCircle(this._pxMaxRadius, this._pxMaxRadius, 0);
          this._rings[1].blendMode = pzlpEngine2d.PIXI.blendModes.SCREEN;

          this._grParent.addChild(this._rings[0]);
          this._grParent.addChild(this._rings[1]);
        },

        /**
         * @summary Updates the animation.
         */
        animate: function (time) {
          this._animationStep++;
          if (this._animationStep < this._MAX_STEPS) {
            this._rings[0].clear();
            this._rings[1].clear();
            
            var factor = this._animationStep / this._MAX_STEPS,
              factorSqrt = Math.sqrt(factor),
              factorSqrtAux = Math.sqrt(0.5 * factor);

            this._rings[0].lineStyle(0.15 * this._pxMaxRadius, 0xFF9F1C, 1 - factor);
            this._rings[0].drawCircle(this._pxMaxRadius, this._pxMaxRadius, (1 + factorSqrt) * factorSqrt * this._pxMaxRadius);
            //this._rings[0].drawCircle(this._pxMaxRadius, this._pxMaxRadius, (1 - factorSqrt) * factorSqrt * this._pxMaxRadius);

            var factor2 = 0.75 * factor
            this._rings[1].lineStyle(0.1 * this._pxMaxRadius, 0xFF9F1C, 1 - factor2 * factor2);

            this._rings[1].drawCircle(this._pxMaxRadius, this._pxMaxRadius, (1 + factorSqrtAux) * factorSqrtAux * this._pxMaxRadius);
          } else {
            this.finish();
          }
        },

        /**
         * @summary Finishes the animation.
         */
        finish: function () {
          if (this._rings) {
            this._grParent.removeChild(this._rings[0]);
            this._grParent.removeChild(this._rings[1]);
            this._rings = null;
          }
        },

        finished: function () {
          return this._rings === null;
        }

      });


      /**
       * @summary ReplicantCell
       */
      function ReplicantCell(id) {
        pzlpEngine2d.PlanarPiece.apply(this, arguments);

        this._grObject = null;
        
        var env = pzlpEngine2d.getEnvironment(),
          camera = env.getCamera();

        this._posToPixels = env.getToPixels();
        this._lengthToPixels = camera.lengthToPixels.bind(camera);

        this._value = 0;
        this._adjacents = [];
        this._createCommand = true;
        this._animation = null;
        this._decorativeAnimations = [];//Animations we don't need to finish prematurely
      }
      ReplicantCell.constructor = ReplicantCell;
        
      _.extend(ReplicantCell.prototype, pzlpEngine2d.PlanarPiece.prototype);
      _.extend(ReplicantCell.prototype, {

        /**
         * @summary Defines a cell structure.
         */
        defineShape: function (value, adjancentCells, pxWidth, pxHeight) {
          this._value = value;
          this._pxWidth = pxWidth;
          this._pxHeight = pxHeight;
          this._adjacents = adjancentCells;

          this._grObject = new pzlpEngine2d.PIXI.DisplayObjectContainer();

          this._updateSprite();
          
          this.enable(true);
          this._updateCell();
        },

        /**
         * @summary Returns whether the cell has no electron or proton.
         */
        isFree: function () {
          return this._value === 0;
        },

        _updateSprite: function () {
          if (this._value === 1 || this._value === -1) {
            this._sprite = this._getNewSprite(this._value);
            this._grObject.addChild(this._sprite);
          }
        },

        /**
         * @summary Returns a new sprite object.
         */
        _getNewSprite: function (value) {
          if (this._value === 1 || this._value === -1) {
            var sprite = pzlpEngine2d.PIXI.Sprite.fromFrame(this._value === 1 ? 'proton-2' : 'electron-2');
            if (this._pxWidth > 0) {
              var sRatio = sprite.height / sprite.width;
              sprite.width = 0.8 * this._pxWidth;
              sprite.height = 0.8 * sRatio * this._pxWidth;
            } else {
              var sRatio = sprite.width / sprite.height;
              sprite.width = 0.8 * sRatio * this._pxHeight;
              sprite.height = 0.8 * this._pxHeight;
            }
            sprite.position.x = 0.125 * sprite.width;
            sprite.position.y = 0.125 * sprite.height;

            return sprite;
          }
          return null;
        },

        getShape: function () {
          return this._grObject;
        },

        enable: function (bEnable) {
          if (bEnable) {
            this._grObject.setInteractive(true);
            this._grObject.buttonMode = true;
            //this._draw();

            // Connect
            this._grObject.click = this._grObject.tap = this._onDistribute.bind(this);
          } else {
            this._grObject.setInteractive(false);
            this._grObject.buttonMode = false;
            this._grObject.clear();

            // Dis-Connect
            this._grObject.mouseup = this._grObject.mouseupoutside = this._grObject.touchend = this._grObject.touchendoutside = null;
            this._grObject.mousedown = this._grObject.touchstart = null;
            this._grObject.click = this._grObject.tap = null;
          }
        },

        /**
         * @summary Main action of the game: when a valid cell is clicked, it is cloned and two animations are started.
         */
        _onDistribute: function () {
          clientGameApp.startTransition();

          // First of all, finish current animations!
          this._onFinishAnimations();

          if (this._createCommand) {
            var cmd = new pzlpEngine2d.NeutralizatorCmd({
              value: this._value,
              pieceId: this.getId(),
              intentClone: true
            });
            this._currentCmd = cmd;
          }

          var animation = new ReplicantAnimation(this._grObject, this._sprite.x, this._sprite.y, this._pxWidth, this._pxHeight);
          animation.onFinish(this._onAnimationFinished.bind(this));

          if (this._value === 1) {//to top-right
            if (!this._adjacents[0] || !this._adjacents[1] || this._adjacents[0]._value === 1 || this._adjacents[1]._value === 1) {
              
              // Command is not valid movement.
              this._currentCmd = null;
              clientGameApp.endTransition();
              return;
            }

            // Ok, movement is valid
            this.playSound('pieceAdded', SOUND_FUSION_VOLUME);

            if (this._adjacents[0]) {
              if (this._adjacents[0]._value) {
                this.playSound('piecesFused', SOUND_FUSION_VOLUME);
              }
              animation.addCell(this._adjacents[0], this._getNewSprite(this._value), this._onEndCloning.bind(this, 0, 1));
            }
            if (this._adjacents[1]) {
              if (this._adjacents[1]._value) {
                this.playSound('piecesFused', SOUND_FUSION_VOLUME);
              }
              animation.addCell(this._adjacents[1], this._getNewSprite(this._value), this._onEndCloning.bind(this, 1, 1));
            }
          } else if (this._value === -1) {//to bottom-left
            if (!this._adjacents[2] || !this._adjacents[3] || this._adjacents[2]._value === -1 || this._adjacents[3]._value === -1) {

              // Command is not valid movement.
              this._currentCmd = null;
              clientGameApp.endTransition();
              return;
            }
            
            // Ok, movement is valid
            this.playSound('pieceAdded', SOUND_FUSION_VOLUME);

            if (this._adjacents[2]) {
              if (this._adjacents[2]._value) {
                this.playSound('piecesFused', SOUND_FUSION_VOLUME);
              }
              animation.addCell(this._adjacents[2], this._getNewSprite(this._value), this._onEndCloning.bind(this, 2, -1));
            }
            if (this._adjacents[3]) {
              if (this._adjacents[3]._value) {
                this.playSound('piecesFused', SOUND_FUSION_VOLUME);
              }
              animation.addCell(this._adjacents[3], this._getNewSprite(this._value), this._onEndCloning.bind(this, 3, -1));
            }
          }

          // Save the animation
          this._animation = animation;

          // Update current cell
          this._value = 0;
          this._updateCell();
        },

        /**
         * @summary Changes the cell's state (TODO: should change the function name!)
         */
        addItem: function (otherValue) {

          this._value += otherValue;
          this._updateCell();
        },

        /**
         * @summary Updates the cell's sprite.
         */
        _updateCell: function () {
          if (this._sprite) {
            this._grObject.removeChild(this._sprite);
            this._sprite = null;
          }
          this._updateSprite();
        },

        /**
         *
         */
        _onEndCloning: function (index, value) {
          this._adjacents[index].addItem(value);

          // If anihilated
          if (this._adjacents[index]._value === 0) {
            var annihilation = new AnnihilationAnimation(this._adjacents[index]);
            this._decorativeAnimations.push(annihilation);
          }
        },

        _onAnimationFinished: function () {
          this._animation = null;
          
          if (this._currentCmd) {
            clientGameApp.addCommand(this._currentCmd);
            clientGameApp.endTransition();
            this._currentCmd = null;
          }
        },

        /**
         * @summary Called whenever we want to finish all current animations.
         */
        onFinishAnimations: function (callback) {
          this._onFinishAnimations = callback;
        },

        getAnimation: function () {
          return this._animation;
        },

        /**
         * @summary Clone current cell and move.
         */
        onDistribute: function (callback) {
          this._createCommand = false;
          this._onDistribute();
          this._createCommand = true;
          this._animation.finish();
          if (callback) {
            callback(true);//true means 're-done'
          }
        },

        /**
         * @summary Undo last clone of current cell.
         */
        onUndoDistribute: function (value, callback) {
          
          // First of all, finish current animations!
          this._onFinishAnimations();

          clientGameApp.startTransition();

          // Undo for current cell
          this._value = value;
          this._updateCell();

          // Then undo for adjacent cells:
          if (this._value === 1) {//to top-right
            for (var h = 0; h < 2; h++) {
              var adj = this._adjacents[h];
              if (adj) {
                if (adj._value === 0) {
                  adj._value = -1;
                  adj._updateCell();
                } else if (adj._value === 1) {
                  adj._value = 0;
                  adj._updateCell();
                } else {
                  console.error("[::onUndoDistribute] Invalid state!");
                }
              }
            }
          } else if (this._value === -1) {//to bottom-left
            for (var h = 0; h < 2; h++) {
              var adj = this._adjacents[h + 2];
              if (adj) {
                if (adj._value === 0) {
                  adj._value = 1;
                  adj._updateCell();
                } else if (adj._value === -1) {
                  adj._value = 0;
                  adj._updateCell();
                } else {
                  console.error("[::onUndoDistribute] Invalid state!");
                }
              }
            }
          }

          // Save the animation
          this._animation = null;

          // Sinces there is no animation, we need to call this directly.
          this._onAnimationFinished();

          // Re-enable machine!
          clientGameApp.endTransition();

          if (callback) {
            callback(true);//means, ok, undone.
          }
        },

        updateAnimations: function (time) {
          if (this._animation) {
            this._animation.animate(time);
          }
          _.each(this._decorativeAnimations, function (u) {
            u.animate(time);
          });

          var countActive = 0;
          for (var i = 0, n = this._decorativeAnimations.length; i < n; i++) {
            if (this._decorativeAnimations[i].finished()) {
              this._decorativeAnimations[i] = null;
            } else {
              countActive++;
            }
          }
          if (countActive === 0) {
            this._decorativeAnimations = [];
          }
        },

        finishAllAnimations: function () {
          if (this._animation) {
            this._animation.finish();
          }
          _.each(this._decorativeAnimations, function (u) {
            u.finish();
          });
          this._decorativeAnimations = [];
        }
      });

      pzlpEngine2d.ReplicantCell = ReplicantCell;
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

      // Require sounds...
      clientGameApp.requireSounds([{
        name: 'ui_sound094',
        path: '/puzzles/cloning'
      }, {
        name: 'ui_sound095',
        path: '/puzzles/cloning'
      }, {
        name: 'ui_sound096',
        path: '/puzzles/cloning'
      }, {
        name: 'ui_sound0114',
        path: '/puzzles/cloning'
      }]);

      clientGameApp.requireMusic([{
        name: 'evilmind_choose_the_right_one',
        path: '/music/evilmind'
      }]);

      // After initializing viewport, we can init the player background texture:
      gameObjects.background = new pzlpEngine2d.Background('0xFDFFFC');

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
      var spritesheet = pzlpEngine2d.ResourceLib.getSpriteSheetPathName('edgar-weto/neutralizator-1');

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
        for (i = 0; i < ROWS; i++) {
          for (j = 0; j < COLS; j++) {
            var c = new pzlpEngine2d.PIXI.Graphics();
            //c.lineStyle(2, 0x011627, 1);
            //c.beginFill(0xFDFFFC);

            c.lineStyle(4, 0x011627, 0.25);
            c.drawRect(0, 0, pxWidth, pxHeight);
            //c.lineStyle(2, 0x011627, 0.5);
            //c.drawRect(0, 0, pxWidth, pxHeight);
            //c.lineStyle(1, 0x011627, 1);
            //c.drawRect(0, 0, pxWidth, pxHeight);

            //c.blendMode = pzlpEngine2d.PIXI.blendModes.SCREEN;
            //c.blendMode = pzlpEngine2d.PIXI.blendModes.OVERLAY;
            

            c.position.x = pxMarginX + pxWidth * j;
            c.position.y = pxMarginY + pxHeight * i;
            frameContainer.addChild(c);
          }
        }
        // Compensate alpha accumulation inside grid:
        var c = new pzlpEngine2d.PIXI.Graphics();
        c.lineStyle(4, 0x011627, 0.25);
        c.drawRect(pxMarginX, pxMarginY, COLS * pxWidth, ROWS * pxHeight);
        frameContainer.addChild(c);


        // Create the interactive cells
        var pieces = [];
        clientGameApp._gameObjects._piecesById = {};
        for (i = 0; i < ROWS; i++) {
          for (j = 0; j < COLS; j++) {
            var cell = new pzlpEngine2d.ReplicantCell(j + COLS * i + 1);

            pieces[j + COLS * i] = cell;
            cell.onFinishAnimations(clientGameApp.finishAllAnimations.bind(clientGameApp));

            var variation = Math.floor(1 + 3.5 * Math.random());
            //console.log("Variation sound:", variation);
            cell.bindSound('piecesFused', 'ui_sound09' + (Math.random() > 0.33 ? ((Math.random() > 0.33 ? 6 : 5)) : 4));
            cell.bindSound('pieceAdded', 'ui_sound0114');

            clientGameApp._gameObjects._piecesById[cell.getId()] = cell;
          }
        }
        
        // Initialize the cells:
        for (i = 0; i < ROWS; i++) {
          for (j = 0; j < COLS; j++) {
            var adjacents = [];

            //0 and 1 are top-right
            adjacents[0] = (i > 0) ? pieces[j + COLS * (i - 1)] : null;
            adjacents[1] = (j < COLS - 1) ? pieces[j + 1 + COLS * i] : null;

            //2, 3 are bottom left
            adjacents[2] = (i < ROWS - 1) ? pieces[j + COLS * (i + 1)] : null;
            adjacents[3] = (j > 0) ? pieces[j - 1 + COLS * i] : null;

            var cellValue = 0;
            if (i==(ROWS-1) && j==0) {
              cellValue = 1;
            } else if (i==0 && j==(COLS-1)) {
              cellValue = -1;
            }
            pieces[j + COLS * i].defineShape(cellValue, adjacents, pxWidth, pxHeight);

            var s = pieces[j + COLS * i].getShape();
            s.position.x = pxMarginX + pxWidth * j;
            s.position.y = pxMarginY + pxHeight * i;
            frameContainer.addChild(s);
          }
        }
        clientGameApp._gameObjects.pieces = pieces;

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

    clientGameApp.finishAllAnimations = function () {
      _.each(this._gameObjects.pieces, function (piece) {
        piece.finishAllAnimations();
      });
    };

    /**
     * @summary Process undo/redo from command machine:
     */
    clientGameApp.movePiece = function (cmd, callback) {
      var cmdData = cmd.getData(),
        pieceId = cmdData.pieceId,
        value = cmdData.value,
        intentClone = cmdData.intentClone,
        cellPiece = this.getPiece(pieceId);

      if (cellPiece) {
        if (intentClone) {//Redo
          cellPiece.onDistribute(callback);
        } else {//Undo
          cellPiece.onUndoDistribute(value, callback);
        }
      } else {
        // @ifdef DEBUG
        console.error("[clientGameApp::movePiece] Piece " + pieceId + " not found!");
        // @endif
      }
    };

    /**
     * @summary Main game loop.
     */
    clientGameApp.gameUpdate = function (step, time) {

      // Animations
      _.each(this._gameObjects.pieces, function (piece) {
        piece.updateAnimations(time);
        // var a = piece.getAnimation();
        // if (a) {
        //   a.animate(time);
        // }
        // _.each(piece.getDecorativeAnimations(), function (u) {
        //   u.animate(time);
        // });

        // var decAnimations = piece.getDecorativeAnimations(),
        //   countActive = 0;
        // for (var i = 0, n = decAnimations.length; i < n; i++) {
        //   if (decAnimations[i].finished()) {
        //     decAnimations[i] = null;
        //   } else {
        //     countActive++;
        //   }
        // }
        // if (countActive === 0) {
        //   piece.clearDecorativeAnimations();
        // }
      });

      // Winning condition: all cells have value 0.
      var solved = true;
      for (var i = 0, n = this._gameObjects.pieces.length; i < n; i++) {
        var piece = this._gameObjects.pieces[i];
        if (!piece.isFree()) {
          solved = false;
          break;
        }
      }

      // If solved, end the game.
      if (solved) {
        this.finishAllAnimations();

        var cmdList = clientGameApp.getCmdList();
        clientGameApp.gameOver({
          solved: true,
          solution: cmdList
        });
      }
    };
  }


}(window.puzzlePlayer));