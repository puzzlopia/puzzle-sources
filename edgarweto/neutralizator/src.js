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
      }
      ReplicantCell.constructor = ReplicantCell;
        
      _.extend(ReplicantCell.prototype, pzlpEngine2d.PlanarPiece.prototype);
      _.extend(ReplicantCell.prototype, {

        /**
         * @summary Defines a cell structure.
         */
        defineShape: function (value, adjancentCells, pxWidth, pxHeight) {
          this._value = value;
          this._grObject = new pzlpEngine2d.PIXI.DisplayObjectContainer();

          this._pxWidth = pxWidth;
          this._pxHeight = pxHeight;

          // var c = new pzlpEngine2d.PIXI.Graphics();
          // c.lineStyle(2, 0xDDDDDD, 1);
          // c.beginFill(0xEEEEEE);
          // c.drawRect(0, 0, this._pxWidth, this._pxHeight);
          // this._grObject.addChildAt(c, 0);
          // this._background = c;

          // var text = new pzlpEngine2d.PIXI.Text(this._value, {font: "50px Arial", fill: "black"});
          // text.position.x = 0.5 * pxWidth;
          // text.position.y = 0.5 * pxHeight;
          // text.anchor.x = 0.5;
          // text.anchor.y = 0.5;
          // this._grObject.addChild(text);
          // this._text = text;

          this._updateSprite();

          this._adjacents = adjancentCells;

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
            var sprite = pzlpEngine2d.PIXI.Sprite.fromFrame(this._value === 1 ? 'proton' : 'electron');
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

          // First of all, finish current animations!
          this._onFinishAnimations();

          var animation = new ReplicantAnimation(this._grObject, this._sprite.x, this._sprite.y, this._pxWidth, this._pxHeight);
          animation.onFinish(this._onAnimationFinished.bind(this));

          var that = this;//EEEPP!!
          if (this._value === 1) {//to top-right
            if (!this._adjacents[0] || !this._adjacents[1] || this._adjacents[0]._value === 1 || this._adjacents[1]._value === 1) {
              return;
            }

            if (this._adjacents[0]) {
              animation.addCell(this._adjacents[0], this._getNewSprite(this._value), function () {
                that._adjacents[0].addItem(1);
              });
            }
            if (this._adjacents[1]) {
              animation.addCell(this._adjacents[1], this._getNewSprite(this._value), function () {
                that._adjacents[1].addItem(1);
              });
            }
          } else if (this._value === -1) {//to bottom-left
            if (!this._adjacents[2] || !this._adjacents[3] || this._adjacents[2]._value === -1 || this._adjacents[3]._value === -1) {
              return;
            }

            if (this._adjacents[2]) {
              animation.addCell(this._adjacents[2], this._getNewSprite(this._value), function () {
                that._adjacents[2].addItem(-1);
              });
            }
            if (this._adjacents[3]) {
              animation.addCell(this._adjacents[3], this._getNewSprite(this._value), function () {
                that._adjacents[3].addItem(-1);
              });
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

        _onAnimationFinished: function () {
          this._animation = null;
        },

        /**
         * @summary Called whenever we want to finish all current animations.
         */
        onFinishAnimations: function (callback) {
          this._onFinishAnimations = callback;
        },

        getAnimation: function () {
          return this._animation;
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
        name: 'piece_drag_3',
        path: '/pieces'
      }]);

      // After initializing viewport, we can init the player background texture:
      var bgImage = webRoot + '/assets/gamelib/textures/grads/grad-13.jpg';
      gameObjects.background = new pzlpEngine2d.Background(bgImage);

      var PIXI = pzlpEngine2d.PIXI,
        camera = env.getCamera();

      // Params
      var cellSize = 1,
        frameMarginX = 1,
        frameMarginY = 1;

        var ROWS = 8,
          COLS = 8;

      var frameWidth = COLS * cellSize + 2 * frameMarginX,
        frameHeight = ROWS * cellSize + 2 * frameMarginY;

      //camera._debug = true;
      camera.setVFactor(1);
      camera.setViewport(-frameWidth/2, frameWidth/2, -frameHeight/2, frameHeight/2);

      // Load resources
      var spritesheet = pzlpEngine2d.ResourceLib.getSpriteSheetPathName('edgar-weto/neutralizator');

      // Load resources
      var loader = new PIXI.AssetLoader([spritesheet]);
      loader.onComplete = function () {
        progressUpdate(0.35);

        //clientGameApp._gameObjects.background = new pzlpEngine2d.Background(pzlpEngine2d.ResourceLib.getTextureName3('textures/backgrounds', 'inflicted.png'));

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
            c.lineStyle(2, 0xDDDDDD, 1);
            c.beginFill(0xEEEEEE);
            c.drawRect(0, 0, pxWidth, pxHeight);

            c.position.x = pxMarginX + pxWidth * j;
            c.position.y = pxMarginY + pxHeight * i;
            frameContainer.addChild(c);
          }
        }

        // Create the interactive cells
        var pieces = [];
        for (i = 0; i < ROWS; i++) {
          for (j = 0; j < COLS; j++) {
            pieces[j + COLS * i] = new pzlpEngine2d.ReplicantCell(j + COLS * i + 1);

            pieces[j + COLS * i].onFinishAnimations(clientGameApp.finishAllAnimations.bind(clientGameApp));
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
            if (i==7 && j==0) {
              cellValue = 1;
            } else if (i==0 && j==7) {
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

        // Ended!
        progressUpdate(0.95);
        callback({});

      };
      loader.load();
      progressUpdate(0.1);
      
    };

    clientGameApp.finishAllAnimations = function () {
      _.each(this._gameObjects.pieces, function (piece) {
        var a = piece.getAnimation();
        if (a) {
          a.finish();
        }
      });
    };

    clientGameApp.gameUpdate = function (step, time) {
      _.each(this._gameObjects.pieces, function (piece) {
        var a = piece.getAnimation();
        if (a) {
          a.animate(time);
        }
      });

      // Winning condition: all pieces have value 0.
      var solved = true;
      for (var i = 0, n = this._gameObjects.pieces.length; i < n; i++) {
        var piece = this._gameObjects.pieces[i];
        if (!piece.isFree()) {
          solved = false;
          break;
        }
      }
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