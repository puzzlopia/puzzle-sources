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
      var s_vertexCount = 0,
        s_toPixels = null,
        s_pixelsToLength = null,
        s_vertexDebug = false;

      function Vertex(parentOrVertex) {
        PIXI.DisplayObjectContainer.call(this);

        s_vertexCount++;
        this._id = s_vertexCount;

        if (parentOrVertex instanceof Vertex) {
          this._initFromVertex(parentOrVertex);
        } else {
          this._initRaw(parentOrVertex);
        }
      }
      Vertex.constructor = Vertex;
      Vertex.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);

      _.extend(Vertex.prototype, {

        /**
         * @summary Initializes from other vertex.
         */
        _initFromVertex: function (v) {
          this._initRaw(v.parent);
          this.setWorldPosition(v._worldPos.x, v._worldPos.y);
          //this.position.x = v.position.x;
          //this.position.y = v.position.y;
        },

        /**
         * @summary Initializes a blank vertex.
         */
        _initRaw: function (gParent) {
          
          this._pxWidth = 0;
          this._pxHeight = 0;
          this._color = 0xFF0000;
          this._colorHit = 0xFFFF00;
          this._animation = null;
          this._worldPos = {
            x: 0,
            y: 0
          };
          this._offset = {
            x: 0,
            y: 0
          };
          this._posObservers = [];

          if (!s_toPixels) {
            var camera = exports.getEnvironment().getCamera();
            s_toPixels = camera.toPixels.bind(camera);
            s_pixelsToLength = camera.pixelsToLength.bind(camera);
          }
          this._toPixels = s_toPixels;
          this._pixelsToLength = s_pixelsToLength;

          this._grObject = new pzlpEngine2d.PIXI.Graphics();
          this._grObject.beginFill(this._color, 1);
          this._grObject.drawCircle(0, 0, 10);
          this.addChild(this._grObject);

          // Finally add to scene:
          gParent.addChild(this);
        },
        
        /**
         * @summary Sets vertex coordinates (both world and pixel) to world coordinates (x,y)
         * @param {bool} dontNotify If true, observers are not notified. This is an optimization when we want to move several vertexs.
         */
        setWorldPosition: function (x, y, dontNotify) {
          this._worldPos.x = x;
          this._worldPos.y = y;
          
          var p = this._toPixels(x, y);
          this.position.x = Math.floor(p.x);
          this.position.y = Math.floor(p.y);

          if (s_vertexDebug) {
            console.log("VERTEX[" + this._id + "] (" + this.position.x + "," + this.position.y + ")", x, y);
          }

          if (!dontNotify) {
            for (var i = 0, n = this._posObservers.length; i < n; i++) {
              this._posObservers[i].onVertexPositionUpdate();
            }
          }
        },

        /**
         * @summary Complex shapes depend on vertex coordinates in order to be visible. This mechanism enables us to
         *  update automatically these changes.
         * @param {object} obj Is the observer object, must implement the 'onVertexPositionUpdate' member function.
         */
        addPositionObserver: function (obj) {
          this._posObservers.push(obj);
        },

        setInteractiveVertex: function () {
          this.setInteractive(true);
          this.buttonMode = true;
          this.hitArea = new PIXI.Circle(0, 0, 20); 

          this.mousedown = this.touchstart = this._onStartDragging.bind(this);
          this.mousemove = this.touchmove = this._onMoveDragging.bind(this);
          this.mouseup = this.mouseupoutside = this.touchend = this.touchendoutside = this._onEndDragging.bind(this);
        },

        /**
         * @summary Starts a drag movement.
         */
        _onStartDragging: function (pixiEv) {
          pixiEv.originalEvent.preventDefault();
          this.lastPixiEv = pixiEv;

          this._worldOffset = {
            x: this._worldPos.x,
            y: this._worldPos.y
          };

          this._dragging = true;

          var p = this.lastPixiEv.getLocalPosition(this);
          this._offset.x = this.position.x + p.x;
          this._offset.y = this.position.y + p.y;

          this.setWorldPosition(this._worldOffset.x, this._worldOffset.y);

          for (var i = 0, n = this._posObservers.length; i < n; i++) {
            if (this._posObservers[i].onVertexPositionUpdateStart) {
              this._posObservers[i].onVertexPositionUpdateStart(this);
            }
          }
        },

        /**
         * @summary Drag move process.
         */
        _onMoveDragging: function (pixiEv) {
          if (this._dragging) {
            var newPosition = this.lastPixiEv.getLocalPosition(this.parent);

            var nx = newPosition.x - this._offset.x,
              ny = newPosition.y - this._offset.y,
              diffX = nx,
              diffY = -ny;

            this._movePixels(diffX, diffY);
          }
          pixiEv.originalEvent.preventDefault();
        },

        _onEndDragging: function (pixiEv) {
          pixiEv.originalEvent.preventDefault();
          this._dragging = false;

          for (var i = 0, n = this._posObservers.length; i < n; i++) {
            this._posObservers[i].onVertexPositionUpdateEnd(this);
          }
        },

        _movePixels: function (pxDx, pxDy) {
          var dx = this._pixelsToLength(pxDx),
            dy = this._pixelsToLength(pxDy);

          if (this._filterMov) {
            var D = this._filterMov(dx, dy);
            
            dx = D.dx;
            dy = D.dy;
          } else {
            console.log("not filtering!");
          }
          this.setWorldPosition(this._worldOffset.x + dx, this._worldOffset.y + dy);
        },

        filterMovements: function (filter) {
          this._filterMov = filter;
        }

      });

      exports.Vertex = Vertex;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));

    // ===============================================================================================
    (function (exports, PIXI) {
      function Edge(gParent, v1, v2) {
        PIXI.DisplayObjectContainer.call(this);

        this._color = 0xFFFFFF;
        this._lineWidth = 2;

        this._grObject = new pzlpEngine2d.PIXI.Graphics();
        this.addChild(this._grObject);

        this._v1 = v1;
        this._v2 = v2;
        v1.addPositionObserver(this);
        v2.addPositionObserver(this);

        // Update to current positions
        this.onVertexPositionUpdate();

        // Finally add whole object
        gParent.addChild(this);
      }
      Edge.constructor = Edge;
      Edge.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);

      _.extend(Edge.prototype, {

        /**
         * @summary This makes order of object instantiation (when building polygons and shapes) independent. So
         *  we can create edges and polygons and then change vertex positions. It also enables realtime updates.
         */
        onVertexPositionUpdate: function () {
          this._grObject.clear();
          this._grObject.lineStyle(this._lineWidth, this._color, 1);
          this._grObject.moveTo(this._v1.position.x, this._v1.position.y);
          this._grObject.lineTo(this._v2.position.x, this._v2.position.y);
        },

        /**
         * @summary 
         */
        onVertexPositionUpdateEnd: function (vertex) {
        }
      });

      exports.Edge = Edge;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));

    // ===============================================================================================
    (function (exports, PIXI) {
      function Polygon(gParent) {
        PIXI.DisplayObjectContainer.call(this);

        gParent.addChild(this);

        this._polyPoints = [];
        this._color = 0x0000cc;
        this._alpha = 1;
      }
      Polygon.constructor = Polygon;
      Polygon.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);

      _.extend(Polygon.prototype, {

        /**
         * @summary Creates a polygon from the vertex list (last vertex is linked with first vertex).
         */
        setShape: function (vertexList) {
          this._vertexs = vertexList;
          
          // The face object
          this._grObject = new PIXI.Graphics();
          this.addChild(this._grObject);

          // The edges
          this._createEdges(vertexList);

          // The vertexs
          this._polyPoints = [];
          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            var v = this._vertexs[i];
            this._polyPoints.push(v.position.x);
            this._polyPoints.push(v.position.y);

            v.addPositionObserver(this);
          }
          this._render();
        },

        setInteractive: function () {
          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            this._vertexs[i].setInteractiveVertex();
          }
          this._alpha = 0.5;
        },

        /**
         * @summary Creates boundary from the vertex list. Creates one edge between each consecutive vertexs.
         */
        _createEdges: function(vertexList) {
          var nVertexs = vertexList.length;

          this._edges = [];
          if (nVertexs > 2) {
            for (var i = 0; i < nVertexs; i++) {
              var seg = new exports.Edge(this, vertexList[i], vertexList[(i + 1) % nVertexs]);
              this._edges[i] = seg;
            }
          } else {
            console.error("[Polygon::setShape] Less than 2 vertexs!");
          }
        },

        _render: function () {

          // We use a mask:
          if (!this._polyMask) {
            this._polyMask = new PIXI.Graphics();
            this._grObject.mask = this._polyMask;
            this.addChild(this._polyMask);
            //this._drawPolygonMask();
          }

          this.onVertexPositionUpdate();
        },

        onVertexPositionUpdate: function () {
          // Recalc bounding box:
          this._bbox = null;

          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            if (!this._bbox) {
              this._bbox = {
                xmin: this._vertexs[i].position.x,
                xmax: this._vertexs[i].position.x,
                ymin: this._vertexs[i].position.y,
                ymax: this._vertexs[i].position.y
              };
            } else {
              var x = this._vertexs[i].position.x,
                y = this._vertexs[i].position.y;

              if (x < this._bbox.xmin) {
                this._bbox.xmin = x;
              }
              if (y < this._bbox.ymin) {
                this._bbox.ymin = y;
              }
              if (this._bbox.xmax < x) {
                this._bbox.xmax = x;
              }
              if (this._bbox.ymax < y) {
                this._bbox.ymax = y;
              }
            }
          }

          // 1. Draw the bounding box
          this._grObject.clear();
          this._grObject.beginFill(this._color, this._alpha);
          this._grObject.drawRect(this._bbox.xmin, this._bbox.ymin, this._bbox.xmax - this._bbox.xmin, this._bbox.ymax - this._bbox.ymin);
          this._grObject.endFill();

          // 2. Apply mask
          this._drawPolygonMask();
        },

        onVertexPositionUpdateEnd: function (vertex) {
        },

        _drawPolygonMask: function () {
          this._polyMask.clear();
          this._polyMask.beginFill();

          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            if (i === 0) {
              this._polyMask.moveTo(this._vertexs[i].position.x, this._vertexs[i].position.y);
            } else {
              this._polyMask.lineTo(this._vertexs[i].position.x, this._vertexs[i].position.y);
            }
          }
          // Add last point
          this._polyMask.lineTo(this._vertexs[0].position.x, this._vertexs[0].position.y);

          this._polyMask.endFill();
        }

      });

      exports.Polygon = Polygon;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));

    // ===============================================================================================
    (function (exports, PIXI) {

      function ConstantAreaTriangle(gParent) {
        exports.Polygon.call(this, gParent);

        this._EPSILON = 0.00001;
        this._SNAP_DIST_PIXELS = 20;
        this._SNAP_DIST_PIXELS2 = this._SNAP_DIST_PIXELS * this._SNAP_DIST_PIXELS;

      }
      ConstantAreaTriangle.constructor = ConstantAreaTriangle;
      _.extend(ConstantAreaTriangle.prototype, exports.Polygon.prototype);

      _.extend(ConstantAreaTriangle.prototype, {

        _parentSetShape: exports.Polygon.prototype.setShape,

        /**
         * @summary Sets the triangle shape and initializes internals.
         */
        setShape: function (vertexList) {
          this._parentSetShape(vertexList);

          this._calcDisplacementVectors();
          this._limitVertexMovements();
          this._createRotateAreas();
        },

        /**
         * @summary Sets a list of fixed vertexs to which snap moved vertexs.
         */
        setSnapVertexs: function (vertexList) {
          this._snapVertexs = vertexList;
        },

        setEditMode: function (m) {
          this._editMode = m;

          var enableRotators = this._editMode === 'rot';
          _.each(this._rotatorVertexs, function (rotator) {
            rotator.enableRotator(enableRotators);
          });
        },

        _limitVertexMovements: function () {
          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            var p = this._vertexs[i];
            if (this._opDisplVectors[i]) {
              p.filterMovements(this._createNewFilter(this._opDisplVectors[i]));
            } else {
              p.filterMovements(null);
            }
          }
        },

        _createNewFilter: function (direction) {
          var ux = direction.x,
            uy = direction.y;

          // This function projects the vector from vertex to (x,y) on the direction vector (should be unitary).
          return function (dx, dy) {
            var h = ux * dx + uy * dy;
            return {
              dx: h * ux,
              dy: h * uy
            };
          };
        },

        /**
         * @summary For each vertex, calculates the parallel vector of opposite side, used to limit vertex mov.
         */
        _calcDisplacementVectors: function () {
          this._opDisplVectors = [];

          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            var p = this._vertexs[(i - 1 + n) % n],
              q = this._vertexs[(i + 1) % n],
              ux = q._worldPos.x - p._worldPos.x,
              uy = q._worldPos.y - p._worldPos.y;


            this._opDisplVectors[i] = null;

            var mod2 = ux * ux + uy * uy;
            if (mod2 > this._EPSILON) {
              var m = Math.sqrt(mod2);

              this._opDisplVectors[i] = {
                x: ux / m,
                y: uy / m
              };
            }
          }
        },

        /**
         * @summary If vertex is near a fixed vertex (measured in pixels), then we modify its position to be the same.
         */
        _snapToFixedVertexs: function (vertex) {
          for (var i = 0, n = this._snapVertexs.length; i < n; i++) {
            var v = this._snapVertexs[i],
              dx = v.position.x - vertex.position.x,
              dy = v.position.y - vertex.position.y,
              d2 = dx * dx + dy * dy;

            if (d2 < this._SNAP_DIST_PIXELS2) {

              vertex.setWorldPosition(v._worldPos.x, v._worldPos.y);

              break;
            }
          }
        },

        /**
         * @summary Things to do when we start moving a vertex: disable rotators.
         */
        onVertexPositionUpdateStart: function () {
          // _.each(this._rotatorVertexs, function (rotator) {
          //   rotator.enableRotator(false);
          // });
        },

        /**
         * @summary When vertex movement ends, we must recalculate several internals and adjust vertex to grid.
         */
        onVertexPositionUpdateEnd: function (vertex) {
          // TODO: we are modifying the vertexs with snap, but if there is other observer notified before, he is not aware of this!!
          // Snap to fixed grid/vertexs
          this._snapToFixedVertexs(vertex);

          // Update internals
          this._calcDisplacementVectors();
          this._limitVertexMovements();
          this._updateRotateAreas();

          // _.each(this._rotatorVertexs, function (rotator) {
          //   rotator.enableRotator(true);
          // });
        },

        /**
         * @summary Recalculates hit areas for rotation.
         */
        _updateRotateAreas: function () {
          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            var v = this._vertexs[i];
            this._rotatorVertexs[i].position.x = v.position.x;
            this._rotatorVertexs[i].position.y = v.position.y;
          }

        },

        /**
         * @summary Creates hit areas for rotation, one for each vertex.
         */
        _createRotateAreas: function () {
          this._rotatorVertexs = [];

          for (var i = 0, n = this._vertexs.length; i < n; i++) {
            var v = this._vertexs[i];

            var rotatorVertex = new exports.VertexRotator(this, i);

            rotatorVertex.position.x = v.position.x;
            rotatorVertex.position.y = v.position.y;
            rotatorVertex.mask = this._polyMask;
            this._rotatorVertexs[i] = rotatorVertex;
          }
        },

        /**
         * @summary Interactive rotation rotates the triangle around a pivot with variable angle. We get a photo of the triangle
         *  before starting rotation. Then we can update to whatever rotation without losing precision. At the end, erase that photo
         *  and establish a snap position if needed.
         */
        startRotateTriangle: function (vertexIdx) {
          var pivot = this._vertexs[vertexIdx],
            index1 = (vertexIdx + 1) % 3,
            index2 = (vertexIdx + 2) % 3,
            v1 = this._vertexs[index1],
            v2 = this._vertexs[index2];

          this._rotationBasis = {
            index1: index1,
            index2: index2,
            w1x: v1._worldPos.x - pivot._worldPos.x,
            w1y: v1._worldPos.y - pivot._worldPos.y,
            w2x: v2._worldPos.x - pivot._worldPos.x,
            w2y: v2._worldPos.y - pivot._worldPos.y
          };
        },
        endRotateTriangle: function (vertexIdx) {
          this._rotationBasis = null;
        },

        /**
         * @summary Rotates the triangle, pivoting on vertex 'vertexIdx'.
         */
        rotateTriangle: function (vertexIdx, cosA, sinA) {
          //console.log(angle);
          var pivot = this._vertexs[vertexIdx];
            // index1 = (vertexIdx + 1) % 3,
            // index2 = (vertexIdx + 2) % 3,
            // v1 = this._vertexs[index1],
            // v2 = this._vertexs[index2],
            // w1x = v1._worldPos.x - pivot._worldPos.x,
            // w1y = v1._worldPos.y - pivot._worldPos.y,
            // w2x = v2._worldPos.x - pivot._worldPos.x,
            // w2y = v2._worldPos.y - pivot._worldPos.y;
            //cosA = Math.cos(angle),
            //sinA = Math.sin(angle);

          var r1x = this._rotationBasis.w1x * cosA - this._rotationBasis.w1y * sinA,
            r1y = this._rotationBasis.w1y * cosA + this._rotationBasis.w1x * sinA,
            r2x = this._rotationBasis.w2x * cosA - this._rotationBasis.w2y * sinA,
            r2y = this._rotationBasis.w2y * cosA + this._rotationBasis.w2x * sinA;

          this._vertexs[this._rotationBasis.index1].setWorldPosition(pivot._worldPos.x + r1x, pivot._worldPos.y + r1y, true);
          this._vertexs[this._rotationBasis.index2].setWorldPosition(pivot._worldPos.x + r2x, pivot._worldPos.y + r2y);
        }
      });

      exports.ConstantAreaTriangle = ConstantAreaTriangle;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));

    // ===============================================================================================
    (function (exports, PIXI) {

      function VertexRotator(gParent, vertexIdx) {
        exports.PIXI.Graphics.call(this);

        this._EPSILON = 0.01;
        this._ROTATION_RADIUS = 45;
        this._ROTATION_RADIUS_D = 10;
        this._color = 0xFFFFFF;
        this._enabled = true;

        this._triangle = gParent;
        this._vertexIdx = vertexIdx;
        gParent.addChild(this);

        this._init();
      }
      VertexRotator.constructor = VertexRotator;
      VertexRotator.prototype = Object.create(PIXI.Graphics.prototype);

      _.extend(VertexRotator.prototype, {

        _init: function () {
          this.buttonMode = true;
          this.setInteractive(true);
          this.hitArea = new PIXI.Circle(0, 0, this._ROTATION_RADIUS); 

          this.mousedown = this.touchstart = this._onStartDragging.bind(this);
          this.mousemove = this.touchmove = this._onMoveDragging.bind(this);
          this.mouseup = this.mouseupoutside = this.touchend = this.touchendoutside = this._onEndDragging.bind(this);

          this.mouseover = this._onMouseOver.bind(this);
          this.mouseout = this._onMouseOverEnd.bind(this);

        },

        _onMouseOver: function () {
          if (this._enabled) {
            this._draw();
          }
        },

        _onMouseOverEnd: function () {
          this.clear();
        },

        _draw: function () {
          this.clear();
          this.lineStyle(1, this._color);
          this.drawCircle(0, 0, this._ROTATION_RADIUS);
          this.drawCircle(0, 0, this._ROTATION_RADIUS + this._ROTATION_RADIUS_D);
        },

        /**
         * @summary Enables/disables the rotator, so that it doesn't interfere with other elements.
         */
        enableRotator: function (e) {
          if (e) {
            this._enabled = true;
            this.buttonMode = true;
            this.setInteractive(true);
          } else {
            this.clear();
            this._enabled = false;
            this.buttonMode = false;
            this.setInteractive(false);
          }
        },

        /**
         * @summary Starts a drag movement that rotates around the vertex.
         */
        _onStartDragging: function (pixiEv) {
          pixiEv.originalEvent.preventDefault();
          this.lastPixiEv = pixiEv;

          this._dragging = true;

          var p = this.lastPixiEv.getLocalPosition(this);
          this._offset = {
            x: this.position.x + p.x,
            y: this.position.y + p.y
          };
          this._sttPoint = p;
          this._triangle.startRotateTriangle(this._vertexIdx);
        },

        /**
         * @summary Drag move process.
         */
        _onMoveDragging: function (pixiEv) {
          if (this._dragging) {
            var newPosition = this.lastPixiEv.getLocalPosition(this.parent),
              ux = newPosition.x - this._offset.x,
              uy = newPosition.y - this._offset.y;

            // Redraw
            this._draw();

            var m1 = Math.sqrt(this._sttPoint.x * this._sttPoint.x + this._sttPoint.y * this._sttPoint.y),
              dx = newPosition.x - this._offset.x,
              dy = newPosition.y - this._offset.y,
              m2 = Math.sqrt(dx * dx + dy * dy);

            if (m1 > this._EPSILON && m2 > this._EPSILON) {
              var ux = this._sttPoint.x / m1,
                uy = this._sttPoint.y / m1,
                vx = dx / m2,
                vy = dy / m2;

              var vLen = 60;

              this.lineStyle(1, 0xFF0000);
              this.moveTo(vLen * ux, vLen * uy);
              this.lineTo(0, 0);
              this.lineStyle(1, 0xFFFFFF);
              this.lineTo(vLen * vx, vLen * vy);
              
              var cosA = ux * vx + uy * vy,
                sign = (uy * vx - ux * vy) > 0 ? 1 : -1,
                sinA = sign * Math.sqrt(1 - cosA * cosA);


              this._triangle.rotateTriangle(this._vertexIdx, cosA, sinA);
            }
          }
          pixiEv.originalEvent.preventDefault();
        },

        /**
         * @summary Ends rotation.
         */
        _onEndDragging: function (pixiEv) {
          pixiEv.originalEvent.preventDefault();
          this._dragging = false;
          
          this._triangle.endRotateTriangle(this._vertexIdx);
          this._draw();
        }

      });

      exports.VertexRotator = VertexRotator;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));


    // ===============================================================================================
    (function (exports, PIXI) {

      // Local camera object
      var s_camera = null;

      /**
       * @summary Implements a basic GUI button.
       */
      function GuiButton(gParent) {
        exports.PIXI.Graphics.call(this);

        this._highlight = false;
        this._selected = false;
        
        if (gParent) {
          gParent.addChild(this);
        } else {
          if (!s_camera) {
            s_camera = exports.getEnvironment().getCamera();
          }
          s_camera.addToScene(this);
        }
      }
      GuiButton.constructor = GuiButton;
      GuiButton.prototype = Object.create(PIXI.Graphics.prototype);

      _.extend(GuiButton.prototype, {

        init: function (pxLeft, pxTop, pxWidth, pxHeight, spriteName) {
          this._pxWidth = pxWidth;
          this._pxHeight = pxHeight;
          this.position.x = pxLeft;
          this.position.y = pxTop;

          this._sprite = PIXI.Sprite.fromFrame(spriteName);
          this._sprite.width = 0.8 * this._pxWidth;
          this._sprite.height = 0.8 * this._pxWidth;
          this._sprite.position.x = 0.125 * this._sprite.width;
          this._sprite.position.y = 0.125 * this._sprite.height;

          this.addChild(this._sprite);

          this.buttonMode = true;
          this.setInteractive(true);
          this.hitArea = new PIXI.Rectangle(0, 0, pxWidth, pxHeight);

          this.mousedown = this.touchstart = this._onClickStart.bind(this);
          this.mouseup = this.mouseupoutside = this.touchend = this.touchendoutside = this._onClick.bind(this);

          this.mouseover = this._onMouseOver.bind(this);
          this.mouseout = this._onMouseOverEnd.bind(this);

          this._draw();
        },

        _draw: function () {
          this.clear();

          var color = this._selected ? 0x88FF88 : 0x888888;
          if (this._highlight) {
            color = this._selected ? 0xccFFcc : 0xcccccc;
          }
          this.beginFill(color);
          this.drawRect(0, 0, this._pxWidth, this._pxHeight);
          this.endFill();
        },
        _onMouseOver: function () {
          this._highlight = true;
          this._draw();
        },
        _onMouseOverEnd: function () {
          this._highlight = false;
          this._draw();
        },
        _onClickStart: function () {
        },
        _onClick: function () {
          if (this._onClickCallback) {
            this._onClickCallback();
          }
        },

        onClick: function (callback) {
          this._onClickCallback = callback;
        },

        fireClick: function () {
          if (this._onClickCallback) {
            this._onClickCallback();
          }
        },

        setBtnSelected: function (sel) {
          this._selected = sel;
          this._draw();
        }
      });
      exports.GuiButton = GuiButton;
    }(pzlpEngine2d, pzlpEngine2d.PIXI));


    // ===============================================================================================
    // ===============================================================================================
    // ===============================================================================================



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

      this._gameObjects = {};
      
      // After initializing viewport, we can init the player background texture:
      this._gameObjects.background = new pzlpEngine2d.Background('0x011627');

      clientGameApp.requireMusic([{
        name: 'ambient-2',
        path: '/music/wowsoundsg'
      }]);


      var PIXI = pzlpEngine2d.PIXI,
        camera = env.getCamera();


      // Params
      var cellSize = 1,
        frameMarginX = 1,
        frameMarginY = 1;

      // Board size
      var ROWS = 12,
        COLS = 12;

      var frameWidth = COLS * cellSize + 2 * frameMarginX,
        frameHeight = ROWS * cellSize + 2 * frameMarginY;

      //camera._debug = true;
      camera.setVFactor(1);
      camera.setViewport(-frameWidth/2, frameWidth/2, -frameHeight/2, frameHeight/2);

      // Load resources
      var loader = new PIXI.AssetLoader([pzlpEngine2d.ResourceLib.getSpriteSheetPathName('edgar-weto/geom-pythagoras/set-1')]);
      loader.onComplete = function () {

        progressUpdate(0.35);

        var frameContainer = new PIXI.DisplayObjectContainer();
        camera.addChildAt(frameContainer, 0);

        // Create main rect-triangle
        var v1 = new pzlpEngine2d.Vertex(frameContainer),
            v2 = new pzlpEngine2d.Vertex(frameContainer),
            v3 = new pzlpEngine2d.Vertex(frameContainer);

        v1.setWorldPosition(2, 2);
        v2.setWorldPosition(2, -1);
        v3.setWorldPosition(-2, -1);

        // Hypotenuse square
        var vOrt = [-3, 4];
        var v4 = new pzlpEngine2d.Vertex(frameContainer),
          v5 = new pzlpEngine2d.Vertex(frameContainer);

        v4.setWorldPosition(2 + vOrt[0], 2 + vOrt[1]);
        v5.setWorldPosition(-2 + vOrt[0], -1 + vOrt[1]);

        // Hypotenuse square
        var vOrt = [-3, 4];
        var v4 = new pzlpEngine2d.Vertex(frameContainer),
          v5 = new pzlpEngine2d.Vertex(frameContainer);

        v4.setWorldPosition(2 + vOrt[0], 2 + vOrt[1]);
        v5.setWorldPosition(-2 + vOrt[0], -1 + vOrt[1]);

        // Mid square
        var vMidOrt = [0, -4];
        var v6 = new pzlpEngine2d.Vertex(frameContainer),
          v7 = new pzlpEngine2d.Vertex(frameContainer);

        v6.setWorldPosition(-2 + vMidOrt[0], -1 + vMidOrt[1]);
        v7.setWorldPosition(2 + vMidOrt[0], -1 + vMidOrt[1]);

        // Small square
        var vSmOrt = [3, 0];
        var v8 = new pzlpEngine2d.Vertex(frameContainer),
          v9 = new pzlpEngine2d.Vertex(frameContainer);

        v8.setWorldPosition(2 + vSmOrt[0], -1 + vSmOrt[1]);
        v9.setWorldPosition(2 + vSmOrt[0], 2 + vSmOrt[1]);

        // Ok, build main rectangle and its squares:
        var tRect = new pzlpEngine2d.Polygon(frameContainer);
        tRect.setShape([v1, v2, v3]);

        var sqBig = new pzlpEngine2d.Polygon(frameContainer);
        sqBig.setShape([v1, v3, v5, v4]);

        var sqMid = new pzlpEngine2d.Polygon(frameContainer);
        sqMid.setShape([v2, v3, v6, v7]);

        var sqSm = new pzlpEngine2d.Polygon(frameContainer);
        sqSm.setShape([v1, v2, v8, v9]);

        // Collect snap vertexes: those not interactive:
        var snapVertexs = [v1, v2, v3, v4, v5, v6, v7, v8, v9];

        // Create the interactive triangles
        // Mid square triangles
        var i2 = new pzlpEngine2d.Vertex(v2),
            i3 = new pzlpEngine2d.Vertex(v3),
            i6 = new pzlpEngine2d.Vertex(v6),
            i7 = new pzlpEngine2d.Vertex(v7);

        var midR1 = new pzlpEngine2d.Polygon(frameContainer),
          midR2 = new pzlpEngine2d.Polygon(frameContainer);
        
        midR1.setShape([i2, i3, i7]);
        midR2.setShape([i3, i6, i7]);

        // Small square triangles
        var s1 = new pzlpEngine2d.Vertex(v1),
            s9 = new pzlpEngine2d.Vertex(v9),
            s8 = new pzlpEngine2d.Vertex(v8),
            ss2 = new pzlpEngine2d.Vertex(v2),
            ss1 = new pzlpEngine2d.Vertex(v1),
            ss8 = new pzlpEngine2d.Vertex(v8);

        var smR1 = new pzlpEngine2d.ConstantAreaTriangle(frameContainer),
          smR2 = new pzlpEngine2d.ConstantAreaTriangle(frameContainer);
        
        smR1.setShape([s1, s9, s8]);
        smR1.setSnapVertexs(snapVertexs);
        smR1._color = 0xcc0000;

        smR2.setShape([ss2, ss1, ss8]);
        smR2.setSnapVertexs(snapVertexs);
        smR2._color = 0x00cc00;

        
        // Create transformations that keeps triangle's area constant. a) move vertex along basis parallel b) rotations around a vertex
        smR1.setInteractive();
        smR2.setInteractive();

        // GUI BUTTONS
        var guiContainer = new pzlpEngine2d.PIXI.DisplayObjectContainer();
        camera.addToScene(guiContainer);

        // adjust to right
        var wndSize = camera.getWindowSize();
        guiContainer.position.x = wndSize.width - 90;
        guiContainer.position.y = wndSize.height / 2 - 80;

        var btnMoveMode = new pzlpEngine2d.GuiButton(guiContainer);
        btnMoveMode.init(0, 0, 60, 60, 'btn-move');

        var btnRotateMode = new pzlpEngine2d.GuiButton(guiContainer);
        btnRotateMode.init(0, 80, 60, 60, 'btn-rotate');

        // Switch between modes
        btnMoveMode.onClick(function () {
          btnMoveMode.setBtnSelected(true);
          btnRotateMode.setBtnSelected(false);

          smR1.setEditMode('move');
          smR2.setEditMode('move');
        });
        btnRotateMode.onClick(function () {
          btnMoveMode.setBtnSelected(false);
          btnRotateMode.setBtnSelected(true);

          smR1.setEditMode('rot');
          smR2.setEditMode('rot');
        });


        btnMoveMode.fireClick();

        // Connect animations
        clientGameApp.updateAnimations = pzlpEngine2d.updateAnimations;
        
        // Finished!
        progressUpdate(0.95);
        callback({});

      };
      loader.load();
      progressUpdate(0.1);
    };


    /**
     * @summary Game's main loop.
     */
    clientGameApp.gameUpdate = function (step, time) {

      // Updates
      this.updateAnimations(time);

      // // Check if puzzle is solved:
      // var solved = true;
      // for (var i = 1; i < 13; i++) {
      //   if (!this.isPieceAtBottom(i)) {
      //     solved = false;
      //     break;
      //   }
      // }
      // //Check that central cell is empty
      // if (solved && !this._gameObjects_.gridLayer.isFreeCell(2, 2)) {
      //   solved = false;
      // }

      // // If solved, end game!
      // if (solved) {
      //   var cmdList = clientGameApp.getCmdList(),
      //     numSteps = cmdList ? cmdList.length : 0,
      //     optSteps = this.gameObjects_.optimalValue !== undefined ? this.gameObjects_.optimalValue : 0;

      //   clientGameApp.gameOver({
      //     solved: true,
      //     solution: cmdList,
      //     performance: Math.floor(10 * ((2 * optSteps) / (optSteps + numSteps)))
      //   });
      // }
    };
  }


}(window.puzzlePlayer));