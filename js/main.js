var wtf = function () {  // start of the wtf namespace

//
// Constants
//

var kParticleZ = 0.1;
var kOverlayZ = 0.2;


//
// Global variables
//

// Wrapper for all WebGL functions and constants.
var gl;

// The 2D canvas context we use for background rendering of text.
var tl;

// The current shader program.
var gShaderProgram
var gTextShader;

// Input handling variables.
var gInput = {
  'keysDown': {},
  'mouseDown': false,
  'lastX': 0,
  'lastY': 0
};


//
// Functions
//

function shader(id)
{
  var elem = document.getElementById(id);
  var type = { "x-shader/x-fragment": gl.FRAGMENT_SHADER,
               "x-shader/x-vertex": gl.VERTEX_SHADER }[elem.type];
  var text = document.getElementById(id).textContent;
  var obj = gl.createShader(type);
  gl.shaderSource(obj, text);
  gl.compileShader(obj);
  if (!gl.getShaderParameter(obj, gl.COMPILE_STATUS))
    throw new Error(id + " shader compilation failed:\n" + gl.getShaderInfoLog(obj));
  return obj;
}


function program(vertShaderID, fragShaderID, uniforms, attribs)
{
  var vertShader = shader(vertShaderID);
  var fragShader = shader(fragShaderID);

  var prog = gl.createProgram();
  gl.attachShader(prog, vertShader);
  gl.attachShader(prog, fragShader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error("Shader linking failed:\n" + gl.getProgramInfoLog(prog));

  gl.useProgram(prog);

  prog.uniforms = {}
  for (var i = 0; i < uniforms.length; i++)
    prog.uniforms[uniforms[i]] = gl.getUniformLocation(prog, uniforms[i]);

  prog.attribs = {};
  for (var i = 0; i < attribs.length; i++)
    prog.attribs[attribs[i]] = gl.getAttribLocation(prog, attribs[i]);

  prog.enableAttribs = function () {
    for (var a in this.attribs)
      gl.enableVertexAttribArray(this.attribs[a]);
  };

  prog.disableAttribs = function () {
    for (var a in this.attribs)
      gl.disableVertexAttribArray(this.attribs[a]);
  }

  return prog;
}


function texture(textureURL)
{
  var tex = gl.createTexture();
  tex.isLoaded = false;
  tex.image = new Image();
  tex.image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    tex.isLoaded = true;
  };
  tex.image.src = textureURL;
  return tex;
}


function text(x, y, message)
{
  // Figure out the size we need the canvas to be.
  //var textSize = ctx.measureText(message);

  tl.clearRect(0, 0, tl.canvas.width, tl.canvas.height);
  tl.fillText(message, x, y);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gl.textTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tl.canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  var world = gl.world;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(gTextShader);
  gTextShader.enableAttribs();
  gl.uniformMatrix4fv(gTextShader.uniforms.worldToViewportMatrix, false, gl.projectionMatrix);

  gl.uniform1f(gTextShader.uniforms.zDepth, kOverlayZ);
  gl.uniform1i(gTextShader.uniforms.texture, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.textPos);
  gl.vertexAttribPointer(gTextShader.attribs['vertexPos'], 2, gl.FLOAT, false, 8, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.textUV);
  gl.vertexAttribPointer(gTextShader.attribs['vertexUV'], 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.disable(gl.BLEND);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  gTextShader.disableAttribs();
}


function init(drawCanvas, textCanvas)
{
  gl = WebGLUtils.setupWebGL(drawCanvas);
  if (!gl)
    return;
  gl.viewportWidth = drawCanvas.width;
  gl.viewportHeight = drawCanvas.height;

  tl = textCanvas.getContext('2d');

  tl.fillStyle = "#CC0000"; 	  // This determines the text colour, it can take a hex value or rgba value (e.g. rgba(255,0,0,0.5))
  tl.textAlign = "left";       // This determines the alignment of text, e.g. left, center, right
  tl.textBaseline = "top";	// This determines the baseline of the text, e.g. top, middle, bottom
  tl.font = "48px monospace";	// This determines the size of the text and the font family used

  // Set up the default camera projection matrix.
  gl.projectionMatrix = mat4.identity();
  //mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, gl.projectionMatrix);
  mat4.ortho(0.0, 1.0, 0.0, 1.0, 10.0, -10.0, gl.projectionMatrix);

  // Set up the camera positioning matrix.
  gl.cameraMatrix = mat4.identity();
  mat4.translate(gl.cameraMatrix, [0, 0, 5]);
  gl.targetDistance = 5;

  // Set up a texture for generating text into.
  gl.textTexture = gl.createTexture();
  gl.textPos = gl.createBuffer();
  gl.textUV = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.textPos);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.1, 0.1,
    0.5, 0.1,
    0.1, 0.3,
    0.5, 0.3
  ]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.textUV);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    1.0, 1.0
  ]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Set up some OpenGL state.
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.cullFace(gl.BACK);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  // Set up the shaders
  gShaderProgram = program("shader-vs", "shader-fs",
      [ "worldToViewportMatrix", "zDepth", "texture" ], // uniforms
      [ "vertexPos" ] );                                // attributes
  gTextShader = program("text-vs", "text-fs",
      [ "worldToViewportMatrix", "zDepth", "texture" ], // uniforms
      [ "vertexPos", "vertexUV" ] );                    // attributes

  // Set up the world.
  var world = {
    'vertexCount': 1024,
    'vertexPos': gl.createBuffer(),
    'texture': texture("img/crate.gif"),
    'points': null,
    'velocities': null,
    'lastUpdate': 0
  };
  var points = [];
  var velocities = [];
  Math.seedrandom('JSPointSprites');
  for (var i = 0; i < world.vertexCount; i++) {
    points.push(Math.random(), Math.random()); // Coords are between 0 and 1.

    // Make sure every particle is moving at a minimum speed.
    var angle = radians(Math.random() * 360);
    var speed = Math.random() * 0.3 + 0.1;
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;
    velocities.push(vx, vy);
  }
  world.points = new Float32Array(points);
  world.velocities = new Float32Array(velocities);
  world.lastUpdate = Date.now();

  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexPos);
  gl.bufferData(gl.ARRAY_BUFFER, world.points, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.world = world;
}


function draw()
{
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var transform;
  if (gl.cameraMatrix) {
    transform = mat4.identity();
    mat4.inverse(gl.cameraMatrix, transform);
    mat4.multiply(gl.projectionMatrix, transform, transform);
  }
  else {
    transform = gl.projectionMatrix;
  }

  // Draw the points.
  var world = gl.world;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, world.texture);

  gl.useProgram(gShaderProgram);
  gShaderProgram.enableAttribs();
  gl.uniformMatrix4fv(gShaderProgram.uniforms.worldToViewportMatrix, false, transform);

  gl.uniform1f(gShaderProgram.uniforms.zDepth, kParticleZ);
  gl.uniform1i(gShaderProgram.uniforms.texture, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexPos);
  gl.vertexAttribPointer(gShaderProgram.attribs['vertexPos'], 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.POINTS, 0, world.vertexCount);

  gl.disable(gl.BLEND);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  gShaderProgram.disableAttribs();

  // Draw the overlay text.
  var frameTime = new Number(Date.now() - world.lastUpdate);
  text(1, 1, "Frame time: " + frameTime.toFixed(0) + " ms");
}


function update()
{
  var world = gl.world;
  var end = world.vertexCount * 2;
  var now = Date.now();

  var dt = (now - world.lastUpdate) / 1000.0; // in seconds

  for (var i = 0; i < end; i++) {
    world.points[i] += world.velocities[i] * dt;
    if (world.points[i] < 0) {
      world.points[i] = -world.points[i];
      world.velocities[i] = -world.velocities[i];
    }
    else if (world.points[i] > 1) {
      world.points[i] = 2.0 - world.points[i];
      world.velocities[i] = -world.velocities[i];
    }
  }

  world.lastUpdate = now;

  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexPos);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.points);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


function keyDown(event)
{
  gInput.keysDown[event.keyCode] = true;
  gInput.keysDown[String.fromCharCode(event.keyCode)] = true;
}


function keyUp(event)
{
  gInput.keysDown[event.keyCode] = false;
  gInput.keysDown[String.fromCharCode(event.keyCode)] = false;
}


function handleKeys()
{
  var speed = 0.10;
  var angle = radians(3);

  if (gInput.keysDown['A'])
    mat4.translate(gl.cameraMatrix, [-speed, 0, 0]);      // move right
  if (gInput.keysDown['D'])
    mat4.translate(gl.cameraMatrix, [speed, 0, 0]);       // move left
  if (gInput.keysDown['E'])
    mat4.translate(gl.cameraMatrix, [0.0, speed, 0]);     // move up
  if (gInput.keysDown['Q'])
    mat4.translate(gl.cameraMatrix, [0.0, -speed, 0]);    // move down

  if (gInput.keysDown['W']) {
    mat4.translate(gl.cameraMatrix, [0.0, 0.0, -speed]);  // move forward
    gl.targetDistance -= speed;
    if (gl.targetDistance < 0)
      gl.targetDistance = 0;
  }
  if (gInput.keysDown['S']) {
    mat4.translate(gl.cameraMatrix, [0.0, 0.0, speed]);   // move back
    gl.targetDistance += speed;
  }

  if (gInput.keysDown[37]) { // left arrow
    mat4.translate(gl.cameraMatrix, [0, 0, -gl.targetDistance]);
    mat4.rotate(gl.cameraMatrix, angle, [0, 1, 0]);       // look left
    mat4.translate(gl.cameraMatrix, [0, 0, gl.targetDistance]);
  }
  if (gInput.keysDown[39]) { // right arrow
    mat4.translate(gl.cameraMatrix, [0, 0, -gl.targetDistance]);
    mat4.rotate(gl.cameraMatrix, -angle, [0, 1, 0]);      // look right
    mat4.translate(gl.cameraMatrix, [0, 0, gl.targetDistance]);
  }
  if (gInput.keysDown[38]) { // up arrow
    mat4.translate(gl.cameraMatrix, [0, 0, -gl.targetDistance]);
    mat4.rotate(gl.cameraMatrix, angle, [1, 0, 0]);       // look up
    mat4.translate(gl.cameraMatrix, [0, 0, gl.targetDistance]);
  }
  if (gInput.keysDown[40]) { // down arrow
    mat4.translate(gl.cameraMatrix, [0, 0, -gl.targetDistance]);
    mat4.rotate(gl.cameraMatrix, -angle, [1, 0, 0]);      // look down
    mat4.translate(gl.cameraMatrix, [0, 0, gl.targetDistance]);
  }
}


function mouseDown(event)
{
  gInput.mouseDown = true;
  gInput.lastX = event.x;
  gInput.lastY = event.y;
}


function mouseUp(event)
{
  gInput.mouseDown = false;
  gInput.lastX = event.x;
  gInput.lastY = event.y;
}


function mouseMove(event)
{
  if (!gInput.mouseDown)
    return;
  
  var axis = vec3.create([event.y - gInput.lastY, event.x - gInput.lastX, 0]);
  var angle = -radians(vec3.length(axis)/* / 10*/);
  vec3.normalize(axis);

  mat4.translate(gl.cameraMatrix, [0, 0, -gl.targetDistance]);
  mat4.rotate(gl.cameraMatrix, angle, axis);
  mat4.translate(gl.cameraMatrix, [0, 0, gl.targetDistance]);

  gInput.lastX = event.x;
  gInput.lastY = event.y;
}


//
// Helpers
//

function radians(angleInDegrees)
{
  return angleInDegrees * Math.PI / 180.0;
}


//
// Main
//

function main(drawCanvasId, textCanvasId)
{
  if (!drawCanvasId)
    drawCanvasId = "wtf-draw-canvas";
  if (!textCanvasId)
    textCanvasId = "wtf-text-canvas";

  var drawCanvas = document.getElementById(drawCanvasId);
  var textCanvas = document.getElementById(textCanvasId);
  init(drawCanvas, textCanvas);

  document.onkeydown = keyDown;
  document.onkeyup = keyUp;
  drawCanvas.onmousedown = mouseDown;
  document.onmouseup = mouseUp;
  document.onmousemove = mouseMove;

  tick = function () {
    window.requestAnimFrame(tick);
    handleKeys();
    draw();
    update();
  }
  tick();
}


return {
  'main': main
};

}(); // end of the wtf namespace.

