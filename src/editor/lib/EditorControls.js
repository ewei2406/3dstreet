import { currentOrthoDir } from './cameras';

/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 */

THREE.EditorControls = function (_object, domElement) {
  domElement = domElement !== undefined ? domElement : document;

  // API

  this.enabled = true;
  this.center = new THREE.Vector3();
  this.panSpeed = 0.001;
  this.zoomSpeed = 0.1;
  this.rotationSpeed = 0.005;

  var object = _object;

  // internals

  var scope = this;
  var vector = new THREE.Vector3();
  var delta = new THREE.Vector3();
  var box = new THREE.Box3();

  var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
  var state = STATE.NONE;

  var center = this.center;
  var normalMatrix = new THREE.Matrix3();
  var pointer = new THREE.Vector2();
  var pointerOld = new THREE.Vector2();
  var spherical = new THREE.Spherical();
  var sphere = new THREE.Sphere();

  this.isOrthographic = false;
  this.rotationEnabled = true;
  this.setCamera = function (_object) {
    object = _object;
    if (object.type === 'OrthographicCamera') {
      this.rotationEnabled = false;
      this.isOrthographic = true;
    } else {
      this.rotationEnabled = true;
      this.isOrthographic = false;
    }
  };
  this.setCamera(_object);

  // events

  var changeEvent = { type: 'change' };

  this.focus = function (target) {
    if (this.isOrthographic) {
      return;
    }
    var distance;

    // Save current camera position/quaternion
    scope.transitionCamPosStart.copy(object.position);
    scope.transitionCamQuaternionStart.copy(object.quaternion);

    box.setFromObject(target);

    if (box.isEmpty() === false && !isNaN(box.min.x)) {
      box.getCenter(center);
      distance = box.getBoundingSphere(sphere).radius;
    } else {
      // Focusing on an Group, AmbientLight, etc

      center.setFromMatrixPosition(target.matrixWorld);
      distance = 0.1;
    }

    object.position.copy(
      target.localToWorld(
        new THREE.Vector3(0, center.y + distance * 0.5, distance * 2.5)
      )
    );
    const pos = target.getWorldPosition(new THREE.Vector3());
    pos.y = center.y;

    object.lookAt(pos);

    // Save end camera position/quaternion
    scope.transitionCamPosEnd.copy(object.position);
    scope.transitionCamQuaternionEnd.copy(object.quaternion);
    // Restore camera position/quaternion and start transition
    object.position.copy(scope.transitionCamPosStart);
    object.quaternion.copy(scope.transitionCamQuaternionStart);
    scope.transitionSpeed = 0.001;
    scope.transitionProgress = 0;
    scope.transitioning = true;
  };

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  this.transitioning = false;
  this.transitionProgress = 0;
  this.transitionCamPosStart = new THREE.Vector3();
  this.transitionCamPosEnd = new THREE.Vector3();
  this.transitionCamQuaternionStart = new THREE.Quaternion();
  this.transitionCamQuaternionEnd = new THREE.Quaternion();
  this.transitionSpeed = 0.001;
  this.fakeComponent = {
    name: 'inspector-editor-controls',
    el: { isPlaying: true },
    isPlaying: true,
    tick: (t, delta) => {
      if (scope.enabled === false) return;
      if (this.transitioning) {
        this.transitionProgress += delta * this.transitionSpeed;
        const easeInOutTransitionProgress = easeInOutQuad(
          this.transitionProgress
        );

        // Set camera position
        object.position.lerpVectors(
          this.transitionCamPosStart,
          this.transitionCamPosEnd,
          easeInOutTransitionProgress
        );

        object.quaternion.slerpQuaternions(
          this.transitionCamQuaternionStart,
          this.transitionCamQuaternionEnd,
          easeInOutTransitionProgress
        );

        if (this.transitionProgress >= 1) {
          this.transitioning = false;
          object.position.copy(this.transitionCamPosEnd);
          object.quaternion.copy(this.transitionCamQuaternionEnd);
        }
        scope.dispatchEvent(changeEvent);
      }
    }
  };
  // Register the tick function with the render loop
  const sceneEl = AFRAME.scenes[0];
  if (sceneEl.componentOrder) {
    // aframe 1.6.0 an above
    sceneEl.componentOrder.push(this.fakeComponent.name);
  }
  sceneEl.addBehavior(this.fakeComponent);

  this.pan = function (delta) {
    var distance;
    if (this.isOrthographic) {
      distance = Math.abs(object.right);
    } else {
      distance = object.position.distanceTo(center);
    }

    delta.multiplyScalar(distance * scope.panSpeed);
    delta.applyMatrix3(normalMatrix.getNormalMatrix(object.matrix));

    object.position.add(delta);
    center.add(delta);

    scope.dispatchEvent(changeEvent);
  };

  var ratio = 1;
  this.setAspectRatio = function (_ratio) {
    ratio = _ratio;
  };

  this.zoom = function (delta) {
    var distance = object.position.distanceTo(center);

    delta.multiplyScalar(distance * scope.zoomSpeed);

    if (delta.length() > distance) return;

    delta.applyMatrix3(normalMatrix.getNormalMatrix(object.matrix));

    if (this.isOrthographic) {
      // Change FOV for ortho.
      let factor = 1;
      if (delta.x + delta.y + delta.z < 0) {
        factor = -1;
      }
      delta = distance * scope.zoomSpeed * factor;
      object.left -= delta * ratio;
      object.bottom -= delta;
      object.right += delta * ratio;
      object.top += delta;
      if (object.left >= -0.0001) {
        return;
      }
      object.updateProjectionMatrix();
    } else {
      object.position.add(delta);
    }

    scope.dispatchEvent(changeEvent);
  };

  this.rotate = function (delta) {
    if (!this.rotationEnabled) {
      return;
    }

    vector.copy(object.position).sub(center);

    spherical.setFromVector3(vector);

    spherical.theta += delta.x;
    spherical.phi += delta.y;

    spherical.makeSafe();

    vector.setFromSpherical(spherical);

    object.position.copy(center).add(vector);

    object.lookAt(center);

    scope.dispatchEvent(changeEvent);
  };

  // mouse

  var changeStateKey = 'shiftKey';

  function onMouseDown(event) {
    if (scope.enabled === false) return;

    if (event.button === 0) {
      state = STATE.PAN;
    } else if (event.button === 1) {
      state = STATE.ZOOM;
    } else if (event.button === 2) {
      state = STATE.ROTATE;
    }

    pointerOld.set(event.clientX, event.clientY);

    domElement.addEventListener('mousemove', onMouseMove, false);
    domElement.addEventListener('mouseup', onMouseUp, false);
    domElement.addEventListener('mouseout', onMouseUp, false);
    domElement.addEventListener('dblclick', onMouseUp, false);
  }

  function onMouseMove(event) {
    if (scope.enabled === false) return;

    if (event.buttons === 1) {
      state = event[changeStateKey] ? STATE.ROTATE : STATE.PAN;
    }

    pointer.set(event.clientX, event.clientY);

    var movementX = pointer.x - pointerOld.x;
    var movementY = pointer.y - pointerOld.y;

    if (state === STATE.ROTATE) {
      scope.rotate(
        delta.set(
          -movementX * scope.rotationSpeed,
          -movementY * scope.rotationSpeed,
          0
        )
      );
    } else if (state === STATE.ZOOM) {
      scope.zoom(delta.set(0, 0, movementY));
    } else if (state === STATE.PAN) {
      scope.pan(delta.set(-movementX, movementY, 0));
    }

    pointerOld.set(event.clientX, event.clientY);
  }

  function onMouseUp(event) {
    domElement.removeEventListener('mousemove', onMouseMove, false);
    domElement.removeEventListener('mouseup', onMouseUp, false);
    domElement.removeEventListener('mouseout', onMouseUp, false);
    domElement.removeEventListener('dblclick', onMouseUp, false);

    state = STATE.NONE;
  }

  function onMouseWheel(event) {
    event.preventDefault();

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      // Normalize deltaY due to https://bugzilla.mozilla.org/show_bug.cgi?id=1392460
      scope.zoom(delta.set(0, 0, event.deltaY > 0 ? 1 : -1));
    } else {
      if (event.deltaX !== 0) {
        // Pan the camera horizontally based on deltaX
        // We use a smaller multiplier for horizontal scroll to make it less sensitive
        scope.pan(delta.set(event.deltaX > 0 ? 10 : -10, 0, 0));
      }
    }
  }

  function contextmenu(event) {
    event.preventDefault();
  }

  this.dispose = function () {
    domElement.removeEventListener('contextmenu', contextmenu, false);
    domElement.removeEventListener('mousedown', onMouseDown, false);
    domElement.removeEventListener('wheel', onMouseWheel, false);

    domElement.removeEventListener('mousemove', onMouseMove, false);
    domElement.removeEventListener('mouseup', onMouseUp, false);
    domElement.removeEventListener('mouseout', onMouseUp, false);
    domElement.removeEventListener('dblclick', onMouseUp, false);

    domElement.removeEventListener('touchstart', touchStart, false);
    domElement.removeEventListener('touchmove', touchMove, false);
  };

  domElement.addEventListener('contextmenu', contextmenu, false);
  domElement.addEventListener('mousedown', onMouseDown, false);
  domElement.addEventListener('wheel', onMouseWheel, false);

  // touch

  var touches = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  var prevTouches = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ];

  var prevDistance = null;

  function touchStart(event) {
    if (scope.enabled === false) return;

    switch (event.touches.length) {
      case 1:
        touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0);
        touches[1].set(event.touches[0].pageX, event.touches[0].pageY, 0);
        break;

      case 2:
        touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0);
        touches[1].set(event.touches[1].pageX, event.touches[1].pageY, 0);
        prevDistance = touches[0].distanceTo(touches[1]);
        break;
    }

    prevTouches[0].copy(touches[0]);
    prevTouches[1].copy(touches[1]);
  }

  function touchMove(event) {
    if (scope.enabled === false) return;

    event.preventDefault();
    event.stopPropagation();

    function getClosest(touch, touches) {
      var closest = touches[0];

      for (var i in touches) {
        if (closest.distanceTo(touch) > touches[i].distanceTo(touch)) {
          closest = touches[i];
        }
      }

      return closest;
    }

    switch (event.touches.length) {
      case 1:
        touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0);
        touches[1].set(event.touches[0].pageX, event.touches[0].pageY, 0);
        scope.rotate(
          touches[0]
            .sub(getClosest(touches[0], prevTouches))
            .multiplyScalar(-scope.rotationSpeed)
        );
        break;

      case 2:
        touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0);
        touches[1].set(event.touches[1].pageX, event.touches[1].pageY, 0);
        var distance = touches[0].distanceTo(touches[1]);
        scope.zoom(delta.set(0, 0, prevDistance - distance));
        prevDistance = distance;

        var offset0 = touches[0]
          .clone()
          .sub(getClosest(touches[0], prevTouches));
        var offset1 = touches[1]
          .clone()
          .sub(getClosest(touches[1], prevTouches));
        offset0.x = -offset0.x;
        offset1.x = -offset1.x;

        scope.pan(offset0.add(offset1).multiplyScalar(0.5));

        break;
    }

    prevTouches[0].copy(touches[0]);
    prevTouches[1].copy(touches[1]);
  }

  domElement.addEventListener('touchstart', touchStart, false);
  domElement.addEventListener('touchmove', touchMove, false);

  // ZoomButtons
  let zoomInInterval;
  let zoomOutInterval;

  this.zoomInStart = () => {
    zoomInInterval = setInterval(() => scope.zoom(delta.set(0, 0, -1)), 50);
  };
  this.zoomInStop = () => clearInterval(zoomInInterval);

  this.zoomOutStart = () => {
    zoomOutInterval = setInterval(() => scope.zoom(delta.set(0, 0, 1)), 50);
  };
  this.zoomOutStop = () => clearInterval(zoomOutInterval);

  this.resetZoom = () => {
    if (this.isOrthographic) {
      const sceneEl = AFRAME.scenes[0];
      const ratio = sceneEl.canvas.width / sceneEl.canvas.height;
      object.left = -40 * ratio;
      object.right = 40 * ratio;
      object.top = 40;
      object.bottom = -40;
      if (currentOrthoDir === 'top') {
        object.position.set(0, 10, 0);
      }
      if (currentOrthoDir === 'front') {
        object.position.set(0, 0, 10);
      }
      object.updateProjectionMatrix();
    } else {
      object.position.set(0, 15, 30);
      object.lookAt(new THREE.Vector3(0, 1.6, -1));
      object.updateMatrixWorld();
    }

    scope.dispatchEvent(changeEvent);
  };
};

THREE.EditorControls.prototype = Object.create(THREE.EventDispatcher.prototype);
THREE.EditorControls.prototype.constructor = THREE.EditorControls;
