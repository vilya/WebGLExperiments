var cat = function () {

//
// Global variables
//

// Wrapper for all WebGL functions and constants. Call initWebGL(canvas) to
// initialise it before using.
var gl;

// The current shader program.
var gShaderProgram
var gGridShader;

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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.bindTexture(gl.TEXTURE_2D, tex);
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


function grid(len)
{
  var size = len * 2;
  var gridCoords = [];
  for (var row = 0; row <= size; row++) {
    var z = 2.0 * (row / size) - 1.0;
    for (var col = 0; col <= size; col++) {
      var x = 2.0 * (col / size) - 1.0;
      gridCoords.push(x, 0, z);
    }
  }

  var gridIndexes = [];
  for (var i = 0; i <= size; i++)
    gridIndexes.push(i * (size + 1), i * (size + 1) + size, i, (size + 1) * size + i);

  var buffer = gl.createBuffer();
  var indexBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridCoords), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(gridIndexes), gl.STATIC_DRAW);

  var theGrid = {
    'buffer': buffer,
    'indexBuffer': indexBuffer,
    'indexCount': gridIndexes.length
  };

  return theGrid;
}


function init(canvas)
{
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl)
    return;

  gl.viewportWidth = canvas.width;
  gl.viewportHeight = canvas.height;

  // Set up the default camera projection matrix.
  gl.projectionMatrix = mat4.identity();
  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, gl.projectionMatrix);

  // Set up the camera positioning matrix.
  gl.cameraMatrix = mat4.identity();
  mat4.translate(gl.cameraMatrix, [0, 0, 5]);
  gl.targetDistance = 5;

  // Set up some OpenGL state.
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.cullFace(gl.BACK);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  // Set up the shaders
  gShaderProgram = program("shader-vs", "shader-fs", [ "worldToViewportMatrix", "texture" ], [ "vertexPos", "vertexColor" ]);
  gGridShader = program("grid-vs", "grid-fs", [ "worldToViewportMatrix", "scale", "color" ], [ "vertexPos" ]);

  // Set up the grid.
  gl.grid = grid(10);

  // Set up the world.
  var world = {
    'vertexCount': 1024,
    'vertexPos': gl.createBuffer(),
    'vertexColor': gl.createBuffer(),
    'texture': texture("img/crate.gif")
  };
  var points = [];
  var colors = [];
  Math.seedrandom('JSPointSprites');
  for (var i = 0; i < world.vertexCount; i++) {
    for (var j = 0; j < 3; j++) {
      points.push(Math.random() * 10.0 - 5.0); 
      colors.push(Math.random());
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexPos);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexColor);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

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
  gl.uniform1i(gShaderProgram.uniforms.texture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexPos);
  gl.vertexAttribPointer(gShaderProgram.attribs['vertexPos'], 3, gl.FLOAT, false, 12, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, world.vertexColor);
  gl.vertexAttribPointer(gShaderProgram.attribs['vertexColor'], 3, gl.FLOAT, false, 12, 0);

  gl.drawArrays(gl.POINTS, 0, world.vertexCount);

  gl.disable(gl.BLEND);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  gShaderProgram.disableAttribs();

  // Draw the grid.
  var showGrid = document.getElementById("showGrid").checked;
  if (showGrid) {
    gl.useProgram(gGridShader);
    gGridShader.enableAttribs();

    gl.uniformMatrix4fv(gGridShader.uniforms.worldToViewportMatrix, false, transform);

    var grid = gl.grid;
    gl.bindBuffer(gl.ARRAY_BUFFER, grid.buffer);
    gl.vertexAttribPointer(gGridShader.attribs.vertexPosAttr, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, grid.indexBuffer);

    var scaleColors = [
      [ 0.0, 0.0, 0.3 ],
      [ 0.4, 0.4, 0.4 ],
      [ 0.0, 0.0, 0.3 ],
    ];
    for (var i = 0; i < 3; i++) {
      gl.uniform3fv(gGridShader.uniforms.color, scaleColors[i]);
      gl.uniform1f(gGridShader.uniforms.scale, i);
      gl.drawElements(gl.LINES, grid.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    gGridShader.disableAttribs();
  }
}


/*
function drawMesh(mesh, transform)
{
  var pointsAttr = mesh.attrs[0];
  if (!mesh.indexBuffer || !pointsAttr.buffer)
    throw "Mesh has no index buffer or points buffer.";

  var showSolid = document.getElementById("showSolid").checked;
  if (showSolid) {
    gl.useProgram(gShaderProgram);
    gShaderProgram.enableAttribs();
    gl.uniformMatrix4fv(gShaderProgram.uniforms.worldToViewportMatrix, false, transform);

    for (var i = 0; i < mesh.attrs.length; i++) {
      var attr = mesh.attrs[i];
      gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer);
      gl.vertexAttribPointer(gShaderProgram.attribs[attr.name], attr.valsPerItem, gl.FLOAT, false, attr.valsPerItem * 4, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  
    gShaderProgram.disableAttribs();
  }

  // Now draw the wireframe and maybe the points as well. We use the same
  // shader for both, so we can just do the initialisation once.
  var showWireframe = document.getElementById("showWireframe").checked;
  var showPoints = document.getElementById("showPoints").checked;

  if (showWireframe || showPoints) {
    gl.useProgram(gWireframeShader);
    gWireframeShader.enableAttribs();
    gl.uniformMatrix4fv(gWireframeShader.uniforms.worldToViewportMatrix, false, transform);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.attrs[mesh.kAttrPoints].buffer);
    gl.vertexAttribPointer(gWireframeShader.attribsvertexPos, 3, gl.FLOAT, false, 12, 0);
  }

  if (showWireframe) {
    gl.uniform4fv(gWireframeShader.uniforms.color, [0.7, 0.7, 0.7, 1.0]);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.outlineIndexBuffer);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(0, -2);
    for (var i = 0; i < mesh.faces.length; i++)
      gl.drawElements(gl.LINE_LOOP, (mesh.start[i+1] - mesh.start[i]), gl.UNSIGNED_SHORT, mesh.start[i] * 2);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  if (showPoints) {
    gl.uniform4fv(gWireframeShader.uniforms.color, [1.0, 1.0, 1.0, 1.0]);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(0, -4);
    gl.drawArrays(gl.POINTS, 0, mesh.edges.length);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  if (showWireframe || showPoints) {
    gWireframeShader.disableAttribs();
  }
  
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}
*/


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
  var speed = 0.2;
  var angle = radians(1);

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


function errorHTML(msg)
{
  str = msg.toString().replace("\n", "<br/>");
  return '' +
    '<table style="background-color: #FAA; width: 100%; height: 100%;"><tr>' +
    '<td align="middle">' +
    '<div style="display: table-cell; vertical-align: middle;">' +
    '<div style="">' + str + '</div>' +
    '</div>' +
    '</td></tr></table>';
}


//
// Main
//

function main(canvasId)
{
  //try {
    var canvas = document.getElementById(canvasId);
    init(canvas);

    document.onkeydown = keyDown;
    document.onkeyup = keyUp;
    canvas.onmousedown = mouseDown;
    document.onmouseup = mouseUp;
    document.onmousemove = mouseMove;

    tick = function () {
      window.requestAnimFrame(tick);
      handleKeys();
      draw();
    }
    tick();
  //}
  //catch (e) {
  //  var container = canvas ? canvas.parentNode : document;
  // container.innerHTML = errorHTML(e);
  //}
}


return {
  'main': main
};

}();
