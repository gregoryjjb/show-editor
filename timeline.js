
Timeline.init = function() {
	
	// UI variables
	this.height = 400;
	this.timeBarHeight = 40;
	this.timeMarkerLabelSize = 14;
	
	this.sideBarWidth = 100;
	this.zoomBarHeight = 30;
	
	this.numTracks = 4; // This will be discarded when files are implemented
	this.trackHeight = 20;
	this.trackSpacing = 10;
	
	this.selectionTolerance = 10;
	this.selectionBoxStart = {"x": 0, "y": 0};
	this.selectionBoxEnd = {"x": 0, "y": 0};
	
	// Colors
	this.lineColor = "rgb(250, 250, 250)";
	this.trackColor = "rgb(122, 122, 122)";
	this.onKeyframeColor = "yellow";
	this.offKeyframeColor = "rgba(0,0,0,0)";
	this.keyframeOutline = "black";
	this.selectedKeyframeOutline = "red";
	this.selectionBoxColor = "#00ccff";
	this.songEndAreaColor = "rgba(0,0,0,0.5)";
	
	// Time
	this.time = 0;
	this.lastFrameTime = 0;
	this.duration = 10; // in seconds
	this.timePercent = 0; // Time in 0-1 format
	this.timeViewPosition = 0; // Time where the left of the view is
	this.timeScale = 100;
	this.timeScaleMin = 10;
	this.timeScaleMax = 400 ;
	
	this.timePanStartX = 0;
	this.timePanStartViewPosition = 0;
	
	this.keyframeDragStartX = -1;
	
	// State
	this.state = {};
	this.state.draggingTime = false;
	this.state.draggingZoom = false;
	this.state.draggingSelection = false;
	this.state.draggingKeyframes = false;
	this.state.draggingPan = false;
	this.state.holdingShift = false;
	this.state.holdingControl = false;
	
	// Keyframing
	this.tracks = [];
	this.selectedKeyframes = [];
	this.activeTracks = [];
	
	// Create canvas
	this.container = $("#timeline-container");
	this.canvas = document.createElement("canvas");
	this.canvas.id = "timeline-canvas";
	this.canvas.height = this.height;
	this.canvas.width = window.innerWidth;
	this.ctx = this.canvas.getContext("2d");
	this.container.append(this.canvas);
	
	// Build keyframes @TODO make this work with files?
	this.buildKeyframes();
	
	// Event listeners go here
	this.canvas.addEventListener("mousedown", this.mouseDown);
	this.canvas.addEventListener("click", this.mouseClicked);
	this.canvas.addEventListener("mousemove", this.mouseMoved);
	this.canvas.addEventListener("mouseup", this.mouseUp);
	document.addEventListener("mouseup", this.mouseUp);
	//this.canvas.addEventListener("mouseout", this.mouseUp);
	this.canvas.addEventListener("wheel", this.mouseWheel);
	document.addEventListener("keydown", this.keyDown);
	document.addEventListener("keyup", this.keyUp);
}

Timeline.mouseDown = function(e) {
	
	var x = e.layerX;
	var y = e.layerY;
	var t = Timeline;
	
	var clicked = e.which;
	var rightClick = (e.which === 3);
	
	// @TODO Make this better
	// We don't want to be able to click while dragging
	if(t.state.draggingKeyframes) {
		if(clicked == LEFTCLICK) {
			t.stopDraggingKeyframes();
		}
		else if(clicked == RIGHTCLICK) {
			t.cancelDraggingKeyframes();
		}
		
		return; // Don't do anything else, just place the keyframes
	}
	
	// Time bar clicked
	if(x > t.sideBarWidth && y < t.timeBarHeight) {
		//t.time = t.xToTime(x);
		t.state.draggingTime = true;
		t.mouseMoved(e);
	}
	
	// Zoom bar clicked
	else if(x < t.sideBarWidth) {
		t.state.draggingZoom = true;
		t.mouseMoved(e);
	}
	
	// Track area clicked
	else if(x > t.sideBarWidth && y > t.timeBarHeight) {
		var clickedTrack = -1;
		clickedTime = t.xToTime(x);
		
		// Find clicked track
		for(let i = 0; i < t.tracks.length; i++) {
			let trackBot = t.timeBarHeight + (i+1) * (t.trackHeight + t.trackSpacing);
			let trackTop = trackBot - t.trackHeight;
			if(y < trackBot && y > trackTop) {
				clickedTrack = i;
				break;
			}
		}
		
		if(clicked == LEFTCLICK) {
			// Deselect everything before new selection if not holding shift
			if(!t.state.holdingShift) t.deselectAllKeyframes();
			var onTopOfKeyframe = false;
			
			if(clickedTrack != -1) {
				let k = t.findClosestKeyframe(clickedTime, clickedTrack);
				let tol = t.getSelectionTolerance();
				
				if(k != null) {
					if(isInside(k.time, clickedTime - tol, clickedTime + tol)) { // k.time < clickedTime + tol && k.time > clickedTime - tol) {
						onTopOfKeyframe = true;
						k.selected = !k.selected;
					}
				}
			}
			
			// Drag box selection if we didn't select a keyframe already
			if(!onTopOfKeyframe) {
				t.state.draggingSelection = true;
				t.selectionBoxStart.x = x;
				t.selectionBoxStart.y = y;
				t.selectionBoxEnd.x = x;
				t.selectionBoxEnd.y = y;
			}
		}
		
		else if(clicked == RIGHTCLICK) {
			// Add new keyframe
			if(clickedTrack != -1) {
				t.tracks[clickedTrack].keyframes.push(new Keyframe(clickedTrack, t.xToTime(x), 0));
			}
			
		}
		
		else if(clicked == MIDCLICK) {
			// Dragging (panning) the timeline
			t.timePanStartX = x;
			t.timePanStartViewPosition = t.timeViewPosition;
			t.state.draggingPan = true;
		}
	}
	
}

Timeline.mouseClicked = function(e) {
	
}

Timeline.mouseMoved = function(e) {
	var x = e.layerX;
	var y = e.layerY;
	var t = Timeline;
	
	if(t.state.draggingTime) {
		// Clamp X so we don't go off the edge
		let limitedX = (x < t.sideBarWidth) ? t.sideBarWidth : x;
		t.time = t.xToTime(limitedX);
		t.timePercent = t.time / t.duration;
		wavesurfer.seekTo(t.timePercent);
		console.log("Changed time", limitedX, t.time);
	}
	
	else if(t.state.draggingZoom) {
		//var zoomPercent = x / t.sideBarWidth;
		//t.timeScale = zoomPercent * 200;
	}
	
	else if(t.state.draggingSelection) {
		t.selectionBoxEnd.x = x;
		t.selectionBoxEnd.y = y;
		
		t.performBoxSelection();
	}
	
	else if(t.state.draggingPan) {
		var deltaX = t.timePanStartX - x;
		var deltaTime = deltaX / t.timeScale;
		//console.log(t.timePanStartViewPosition);
		t.timeViewPosition = Math.clamp(t.timePanStartViewPosition + deltaTime, 0, t.duration);
	}
	
	else if(t.state.draggingKeyframes) {
		
		if(t.keyframeDragStartX == -1) t.keyframeDragStartX = x;
		
		var deltaX = x - t.keyframeDragStartX;
		var deltaTime = deltaX / t.timeScale;
		
		var selKeys = t.selectedKeyframes;
		
		for(let i = 0; i < selKeys.length; i++) {
			var k = selKeys[i];
			
			k.time = k.oldTime + deltaTime;
		}
	}
}

Timeline.mouseUp = function(e) {
	var t = Timeline;
	
	// Clear state variables
	t.state.draggingTime = false;
	t.state.draggingZoom = false;
	t.state.draggingSelection = false;
	t.state.draggingPan = false;
}

Timeline.mouseWheel = function(e) {
	var t = Timeline;
	var goingUp = (e.deltaY < 0);
	
	if(goingUp) {
		t.timeScale += 10;
	}
	else {
		t.timeScale -= 10;
	}
	
	t.timeScale = Math.clamp(t.timeScale, t.timeScaleMin, t.timeScaleMax);
	
	wavesurfer.zoom(t.timeScale);
	
	console.log("Timescale", t.timeScale);
}

Timeline.keyDown = function(e) {
	
	// Switch based on key
	var key = e.keyCode;
	
	if(key == KEY_DEL) {
		console.log("delete");
		Timeline.deleteSelectedKeyframes();
	}
	
	if(key == KEY_A) {
		Timeline.performAlign();
	}
	
	if(key == KEY_D) {
		Timeline.duplicateKeyframes();
	}
	
	if(key == KEY_G) {
		//Timeline.state.draggingKeyframes = true;
		Timeline.startDraggingKeyframes();
	}
	
	if(key == KEY_I) {
		Timeline.performKeyframeInvert();
	}
	
	if(key == KEY_SHIFT) {
		Timeline.state.holdingShift = true;
	}
	
	if(key == KEY_CTRL) {
		Timeline.state.holdingControl = true;
	}
}

Timeline.keyUp = function(e) {
	var key = e.keyCode;
	
	if(key == KEY_G) {
		//Timeline.stopDraggingKeyframes();
	}
	
	if(key == KEY_SHIFT) {
		Timeline.state.holdingShift = false;
	}
	
	if(key == KEY_CTRL) {
		Timeline.state.holdingControl = false;
	}
}

Timeline.drawGUI = function() {
	
	// Update width in case of resize
	this.canvas.width = window.innerWidth;
	
	var w = this.canvas.width;
	var h = this.canvas.height;
	
	var side = this.sideBarWidth;
	
	this.ctx.clearRect(0, 0, w, h);
	
	// Draw time bar
	this.ctx.beginPath();
	this.ctx.strokeStyle = this.lineColor;
	this.ctx.moveTo(side, this.timeBarHeight);
	this.ctx.lineTo(w, this.timeBarHeight);
	this.ctx.stroke();
	
	// Draw time markers
	var markerSpacing = this.getTimeMarkerSpacing();
	const firstMarker = Math.roundUp(this.timeViewPosition, markerSpacing);
	var currentMarker = firstMarker;
	do {
		var xpos = this.timeToX(currentMarker);
		var ypos = this.timeBarHeight / 3
		this.drawLine(xpos, 0, xpos, ypos);
		var labelSize = this.timeMarkerLabelSize + "px";
		var labelOffset = this.timeMarkerLabelSize + 2;
		this.drawText(currentMarker.toTimeString(), xpos, ypos + labelOffset, this.lineColor, labelSize);
		currentMarker += markerSpacing;
	} while (xpos < w);
	
	// Draw zoom area
	var zoomBarY = h - this.zoomBarHeight;
	this.drawLine(0, zoomBarY, side, zoomBarY, this.lineColor);
	
	// Draw channel bars
	for(let i = 0; i < this.tracks.length; i++) {
		// Draw bar
		this.ctx.fillStyle = this.trackColor;
		let yPos = this.timeBarHeight + this.trackSpacing + i * (this.trackHeight + this.trackSpacing);
		this.ctx.fillRect(side, yPos, w-side, this.trackHeight);
		
		// Draw label
		this.ctx.font = "16px arial";
		// Temporary: adjust label colors like lights
		if(this.activeTracks[i]) this.ctx.fillStyle = "white";
		else this.ctx.fillStyle = "black";
		
		//this.ctx.fillStyle = this.lineColor;
		this.ctx.fillText("Channel " + (i+1), 10, yPos + 16);
	}
	
	// Draw keyframes
	for(let i = 0; i < this.tracks.length; i++) {
		// For keyframes in track
		for(let j = 0; j < this.tracks[i].keyframes.length; j++) {
			var x = this.timeToX(this.tracks[i].keyframes[j].time);
			if(x >= side) {
				var y = this.getKeyframeY(i);
				var state = this.tracks[i].keyframes[j].state;
				var selected = this.tracks[i].keyframes[j].selected;
				var fillColor = (state) ? this.onKeyframeColor : this.offKeyframeColor;
				var lineColor = (selected) ? this.selectedKeyframeOutline : this.keyframeOutline;
				this.drawDiamond(x, y, 8, lineColor, fillColor);
			}
		}
	}
	
	// Draw greyed-out area where song ends
	var songEndX = this.timeToX(this.duration);
	if(songEndX < w) {
		let width = w - songEndX;
		let height = h - this.timeBarHeight;
		
		this.ctx.fillStyle = this.songEndAreaColor;
		this.ctx.fillRect(songEndX, this.timeBarHeight + 1, width, height);
	}
	
	// Draw time position indicator
	var timeX = this.timeToX(this.time);
	if(timeX >= side) this.drawLine(timeX, 0, timeX, h, "#cc0000");
	
	// Draw selection box
	if(this.state.draggingSelection) {
		var sizeX = this.selectionBoxEnd.x - this.selectionBoxStart.x;
		var sizeY = this.selectionBoxEnd.y - this.selectionBoxStart.y;
		
		this.ctx.strokeStyle = this.selectionBoxColor;
		this.ctx.beginPath();
		this.ctx.strokeRect(this.selectionBoxStart.x, this.selectionBoxStart.y, sizeX, sizeY);
		this.ctx.stroke();
	}
	
	// FOR DEBUGGING: Draw FPS
	this.drawText(this.actualfps, 0, 14, "red", 14);
}

Timeline.update = function() {
	
	this.updateTime();
	
	this.selectedKeyframes = this.getSelectedKeyframes();
	
	this.drawGUI();
	
	// DO DELTA TIME FPS STUFF
	var date = new Date();
	var now = date.getTime();
	var delta = now - this.lastTime;
	
	this.actualfps = Math.round(1000 / delta);
	
	this.lastTime = now;
	//console.log(this.actualfps);
}

Timeline.updateTime = function() {
	// If the time has been changed
	if(this.lastFrameTime != this.time) {
		this.updateActiveTracks();
	}
	this.lastFrameTime = this.time;
	
	this.timePercent = this.time / this.duration;
	
	// if audio is playing update our position to match
	if(wavesurfer.isPlaying()) {
		this.time = wavesurfer.getCurrentTime();
		//this.updateActiveTracks();
	}
	
	//console.log(this.findClosestKeyframe(this.time, 0, true));
}

Timeline.updateActiveTracks = function() {
	
	if(this.activeTracks.length == 0) {
		for(let j = 0; j < this.tracks.length; j++) {
			this.activeTracks.push(0);
		}
	}
	
	for(let i = 0; i < this.tracks.length; i++) {
		
		let lastKeyframe = this.findClosestKeyframe(this.time, i, true);
		
		if(lastKeyframe != null) this.activeTracks[i] = lastKeyframe.state;
		else this.activeTracks[i] = 0;
	}
	
	console.log(this.activeTracks);
}

// Helper functions
Timeline.drawLine = function(x, y, xend, yend, color) {
	this.ctx.strokeStyle = color;
	this.ctx.beginPath();
	this.ctx.moveTo(x+0.5, y+0.5);
	this.ctx.lineTo(xend+0.5, yend+0.5);
	this.ctx.stroke();
}

Timeline.drawText = function(text, x, y, color, size) {
	this.ctx.font = size + " arial";
	this.ctx.fillStyle = color;
	this.ctx.fillText(text, x, y);
}

Timeline.drawDiamond = function(x, y, size, color, fillColor) {
	this.ctx.strokeStyle = color;
	this.ctx.beginPath();
	this.ctx.moveTo(x-size, y);
	this.ctx.lineTo(x, y-size);
	this.ctx.lineTo(x+size, y);
	this.ctx.lineTo(x, y+size);
	this.ctx.closePath();
	
	if(fillColor != "") {
		this.ctx.fillStyle = fillColor;
		this.ctx.fill();
	}
	
	this.ctx.stroke();
}

Timeline.getKeyframeY = function(track) {
	var y = (this.timeBarHeight + this.trackSpacing) + track * (this.trackHeight + this.trackSpacing);
	return y + this.trackHeight / 2;
}

// @todo fix this
Timeline.timeToX = function(t) {
	return this.sideBarWidth + (t - this.timeViewPosition) * this.timeScale; // Replace 0 with time offset
}
Timeline.xToTime = function(x) {
	
	let timeArea = this.canvas.width - this.sideBarWidth;
	let xInArea = x - this.sideBarWidth;
	return xInArea / this.timeScale + this.timeViewPosition;  // Replace 0 with time offset
}

Timeline.getSelectionTolerance = function() {
	return this.selectionTolerance / this.timeScale;
}

// FOR DEBUGGING ONLY
Timeline.buildKeyframes = function() {
	
	/*for(let i = 0; i < this.numTracks; i++){
		
		// Build frames
		//var k = [new Keyframe(i, 1.5, 1)];
		var keys = [];
		
		for(let j = 1; j < 100; j++) {
			//keys.push(new Keyframe(i, 120 * Math.random(), Math.round(Math.random())));
		}
		
		// Build track
		var t = new Track(i, keys);
		
		this.tracks.push(t);
	}*/
	
	//this.tracks = [{"id":0,"keyframes":[{"channel":0,"time":0.37333333333333335,"oldTime":0.37333333333333335,"state":true,"selected":false},{"channel":0,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":0,"time":1.16,"oldTime":1.16,"state":true,"selected":false},{"channel":0,"time":1.76,"oldTime":1.76,"state":0,"selected":false},{"channel":0,"time":1.95,"oldTime":1.95,"state":true,"selected":false},{"channel":0,"time":2.545,"oldTime":2.545,"state":0,"selected":false},{"channel":0,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":true,"selected":false},{"channel":0,"time":3.341875,"oldTime":3.341875,"state":0,"selected":false},{"channel":0,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":true,"selected":false},{"channel":0,"time":4.139669117647059,"oldTime":4.139669117647059,"state":0,"selected":false},{"channel":0,"time":4.391544117647059,"oldTime":4.391544117647059,"state":true,"selected":false},{"channel":0,"time":4.9029131652661055,"oldTime":4.9029131652661055,"state":0,"selected":false},{"channel":0,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":0,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":0,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":0,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":0,"time":6.019579831932773,"oldTime":6.019579831932773,"state":true,"selected":false},{"channel":0,"time":6.232079831932773,"oldTime":6.232079831932773,"state":0,"selected":false}]},{"id":1,"keyframes":[{"channel":1,"time":0.37333333333333335,"oldTime":0.37333333333333335,"state":true,"selected":false},{"channel":1,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":1,"time":1.16,"oldTime":1.16,"state":true,"selected":false},{"channel":1,"time":1.76,"oldTime":1.76,"state":0,"selected":false},{"channel":1,"time":1.95,"oldTime":1.95,"state":true,"selected":false},{"channel":1,"time":2.545,"oldTime":2.545,"state":0,"selected":false},{"channel":1,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":true,"selected":false},{"channel":1,"time":3.341875,"oldTime":3.341875,"state":0,"selected":false},{"channel":1,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":true,"selected":false},{"channel":1,"time":4.139669117647059,"oldTime":4.139669117647059,"state":0,"selected":false},{"channel":1,"time":4.391544117647059,"oldTime":4.391544117647059,"state":true,"selected":false},{"channel":1,"time":4.9029131652661055,"oldTime":4.9029131652661055,"state":0,"selected":false},{"channel":1,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":1,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":1,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":1,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":1,"time":5.7745798319327735,"oldTime":5.7745798319327735,"state":true,"selected":false},{"channel":1,"time":6.432079831932772,"oldTime":6.432079831932772,"state":0,"selected":false}]},{"id":2,"keyframes":[{"channel":2,"time":0.37333333333333335,"oldTime":0.37333333333333335,"state":true,"selected":false},{"channel":2,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":2,"time":1.16,"oldTime":1.16,"state":true,"selected":false},{"channel":2,"time":1.76,"oldTime":1.76,"state":0,"selected":false},{"channel":2,"time":1.95,"oldTime":1.95,"state":true,"selected":false},{"channel":2,"time":2.545,"oldTime":2.545,"state":0,"selected":false},{"channel":2,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":true,"selected":false},{"channel":2,"time":3.341875,"oldTime":3.341875,"state":0,"selected":false},{"channel":2,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":true,"selected":false},{"channel":2,"time":4.139669117647059,"oldTime":4.139669117647059,"state":0,"selected":false},{"channel":2,"time":4.391544117647059,"oldTime":4.391544117647059,"state":true,"selected":false},{"channel":2,"time":4.9029131652661055,"oldTime":4.9029131652661055,"state":0,"selected":false},{"channel":2,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":2,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":2,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":2,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":2,"time":5.552079831932773,"oldTime":5.552079831932773,"state":true,"selected":false},{"channel":2,"time":6.628329831932772,"oldTime":6.628329831932772,"state":0,"selected":false}]},{"id":3,"keyframes":[{"channel":3,"time":0.99,"oldTime":0.99,"state":true,"selected":false},{"channel":3,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":3,"time":1.1675,"oldTime":1.1675,"state":0,"selected":false},{"channel":3,"time":1.76,"oldTime":1.76,"state":true,"selected":false},{"channel":3,"time":1.95,"oldTime":1.95,"state":0,"selected":false},{"channel":3,"time":2.545,"oldTime":2.545,"state":true,"selected":false},{"channel":3,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":0,"selected":false},{"channel":3,"time":3.341875,"oldTime":3.341875,"state":true,"selected":false},{"channel":3,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":0,"selected":false},{"channel":3,"time":4.139669117647059,"oldTime":4.139669117647059,"state":true,"selected":false},{"channel":3,"time":4.391544117647059,"oldTime":4.391544117647059,"state":0,"selected":false},{"channel":3,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":3,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":3,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":3,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":3,"time":5.362079831932773,"oldTime":5.362079831932773,"state":true,"selected":false},{"channel":3,"time":6.628329831932772,"oldTime":6.628329831932772,"state":0,"selected":false}]}];
	this.tracks = [{"id":0,"keyframes":[{"channel":0,"time":0.37333333333333335,"oldTime":0.37333333333333335,"state":true,"selected":false},{"channel":0,"time":0.44499999999999995,"oldTime":0.44499999999999995,"state":0,"selected":false},{"channel":0,"time":0.5233333333333333,"oldTime":0.5233333333333333,"state":true,"selected":false},{"channel":0,"time":0.6,"oldTime":0.6,"state":0,"selected":false},{"channel":0,"time":0.6733333333333333,"oldTime":0.6733333333333333,"state":true,"selected":false},{"channel":0,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":0,"time":1.16,"oldTime":1.16,"state":true,"selected":false},{"channel":0,"time":1.24,"oldTime":1.24,"state":0,"selected":false},{"channel":0,"time":1.3183333333333334,"oldTime":1.3183333333333334,"state":true,"selected":false},{"channel":0,"time":1.395,"oldTime":1.395,"state":0,"selected":false},{"channel":0,"time":1.4683333333333333,"oldTime":1.4683333333333333,"state":true,"selected":false},{"channel":0,"time":1.76,"oldTime":1.76,"state":0,"selected":false},{"channel":0,"time":1.95,"oldTime":1.95,"state":true,"selected":false},{"channel":0,"time":2.035,"oldTime":2.035,"state":0,"selected":false},{"channel":0,"time":2.1133333333333333,"oldTime":2.1133333333333333,"state":true,"selected":false},{"channel":0,"time":2.19,"oldTime":2.19,"state":0,"selected":false},{"channel":0,"time":2.263333333333333,"oldTime":2.263333333333333,"state":true,"selected":false},{"channel":0,"time":2.545,"oldTime":2.545,"state":0,"selected":false},{"channel":0,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":true,"selected":false},{"channel":0,"time":2.8325,"oldTime":2.8325,"state":0,"selected":false},{"channel":0,"time":2.910833333333333,"oldTime":2.910833333333333,"state":true,"selected":false},{"channel":0,"time":2.9875,"oldTime":2.9875,"state":0,"selected":false},{"channel":0,"time":3.060833333333333,"oldTime":3.060833333333333,"state":true,"selected":false},{"channel":0,"time":3.341875,"oldTime":3.341875,"state":0,"selected":false},{"channel":0,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":true,"selected":false},{"channel":0,"time":3.65,"oldTime":3.65,"state":0,"selected":false},{"channel":0,"time":3.728333333333333,"oldTime":3.728333333333333,"state":true,"selected":false},{"channel":0,"time":3.8049999999999997,"oldTime":3.8049999999999997,"state":0,"selected":false},{"channel":0,"time":3.878333333333333,"oldTime":3.878333333333333,"state":true,"selected":false},{"channel":0,"time":4.139669117647059,"oldTime":4.139669117647059,"state":0,"selected":false},{"channel":0,"time":4.391544117647059,"oldTime":4.391544117647059,"state":true,"selected":false},{"channel":0,"time":4.465,"oldTime":4.465,"state":0,"selected":false},{"channel":0,"time":4.543333333333333,"oldTime":4.543333333333333,"state":true,"selected":false},{"channel":0,"time":4.62,"oldTime":4.62,"state":0,"selected":false},{"channel":0,"time":4.693333333333333,"oldTime":4.693333333333333,"state":true,"selected":false},{"channel":0,"time":4.9029131652661055,"oldTime":4.9029131652661055,"state":0,"selected":false},{"channel":0,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":0,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":0,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":0,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":0,"time":6.019579831932773,"oldTime":6.019579831932773,"state":true,"selected":false},{"channel":0,"time":6.232079831932773,"oldTime":6.232079831932773,"state":0,"selected":false}]},{"id":1,"keyframes":[{"channel":1,"time":0.37333333333333335,"oldTime":0.37333333333333335,"state":true,"selected":false},{"channel":1,"time":0.44499999999999995,"oldTime":0.44499999999999995,"state":0,"selected":false},{"channel":1,"time":0.5233333333333333,"oldTime":0.5233333333333333,"state":true,"selected":false},{"channel":1,"time":0.6,"oldTime":0.6,"state":0,"selected":false},{"channel":1,"time":0.6733333333333333,"oldTime":0.6733333333333333,"state":true,"selected":false},{"channel":1,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":1,"time":1.16,"oldTime":1.16,"state":true,"selected":false},{"channel":1,"time":1.24,"oldTime":1.24,"state":0,"selected":false},{"channel":1,"time":1.3183333333333334,"oldTime":1.3183333333333334,"state":true,"selected":false},{"channel":1,"time":1.395,"oldTime":1.395,"state":0,"selected":false},{"channel":1,"time":1.4683333333333333,"oldTime":1.4683333333333333,"state":true,"selected":false},{"channel":1,"time":1.76,"oldTime":1.76,"state":0,"selected":false},{"channel":1,"time":1.95,"oldTime":1.95,"state":true,"selected":false},{"channel":1,"time":2.035,"oldTime":2.035,"state":0,"selected":false},{"channel":1,"time":2.1133333333333333,"oldTime":2.1133333333333333,"state":true,"selected":false},{"channel":1,"time":2.19,"oldTime":2.19,"state":0,"selected":false},{"channel":1,"time":2.263333333333333,"oldTime":2.263333333333333,"state":true,"selected":false},{"channel":1,"time":2.545,"oldTime":2.545,"state":0,"selected":false},{"channel":1,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":true,"selected":false},{"channel":1,"time":2.8325,"oldTime":2.8325,"state":0,"selected":false},{"channel":1,"time":2.910833333333333,"oldTime":2.910833333333333,"state":true,"selected":false},{"channel":1,"time":2.9875,"oldTime":2.9875,"state":0,"selected":false},{"channel":1,"time":3.060833333333333,"oldTime":3.060833333333333,"state":true,"selected":false},{"channel":1,"time":3.341875,"oldTime":3.341875,"state":0,"selected":false},{"channel":1,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":true,"selected":false},{"channel":1,"time":3.65,"oldTime":3.65,"state":0,"selected":false},{"channel":1,"time":3.728333333333333,"oldTime":3.728333333333333,"state":true,"selected":false},{"channel":1,"time":3.8049999999999997,"oldTime":3.8049999999999997,"state":0,"selected":false},{"channel":1,"time":3.878333333333333,"oldTime":3.878333333333333,"state":true,"selected":false},{"channel":1,"time":4.139669117647059,"oldTime":4.139669117647059,"state":0,"selected":false},{"channel":1,"time":4.391544117647059,"oldTime":4.391544117647059,"state":true,"selected":false},{"channel":1,"time":4.465,"oldTime":4.465,"state":0,"selected":false},{"channel":1,"time":4.543333333333333,"oldTime":4.543333333333333,"state":true,"selected":false},{"channel":1,"time":4.62,"oldTime":4.62,"state":0,"selected":false},{"channel":1,"time":4.693333333333333,"oldTime":4.693333333333333,"state":true,"selected":false},{"channel":1,"time":4.9029131652661055,"oldTime":4.9029131652661055,"state":0,"selected":false},{"channel":1,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":1,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":1,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":1,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":1,"time":5.7745798319327735,"oldTime":5.7745798319327735,"state":true,"selected":false},{"channel":1,"time":6.432079831932772,"oldTime":6.432079831932772,"state":0,"selected":false}]},{"id":2,"keyframes":[{"channel":2,"time":0.37333333333333335,"oldTime":0.37333333333333335,"state":true,"selected":false},{"channel":2,"time":0.44499999999999995,"oldTime":0.44499999999999995,"state":0,"selected":false},{"channel":2,"time":0.5233333333333333,"oldTime":0.5233333333333333,"state":true,"selected":false},{"channel":2,"time":0.6,"oldTime":0.6,"state":0,"selected":false},{"channel":2,"time":0.6733333333333333,"oldTime":0.6733333333333333,"state":true,"selected":false},{"channel":2,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":2,"time":1.16,"oldTime":1.16,"state":true,"selected":false},{"channel":2,"time":1.24,"oldTime":1.24,"state":0,"selected":false},{"channel":2,"time":1.3183333333333334,"oldTime":1.3183333333333334,"state":true,"selected":false},{"channel":2,"time":1.395,"oldTime":1.395,"state":0,"selected":false},{"channel":2,"time":1.4683333333333333,"oldTime":1.4683333333333333,"state":true,"selected":false},{"channel":2,"time":1.76,"oldTime":1.76,"state":0,"selected":false},{"channel":2,"time":1.95,"oldTime":1.95,"state":true,"selected":false},{"channel":2,"time":2.035,"oldTime":2.035,"state":0,"selected":false},{"channel":2,"time":2.1133333333333333,"oldTime":2.1133333333333333,"state":true,"selected":false},{"channel":2,"time":2.19,"oldTime":2.19,"state":0,"selected":false},{"channel":2,"time":2.263333333333333,"oldTime":2.263333333333333,"state":true,"selected":false},{"channel":2,"time":2.545,"oldTime":2.545,"state":0,"selected":false},{"channel":2,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":true,"selected":false},{"channel":2,"time":2.8325,"oldTime":2.8325,"state":0,"selected":false},{"channel":2,"time":2.910833333333333,"oldTime":2.910833333333333,"state":true,"selected":false},{"channel":2,"time":2.9875,"oldTime":2.9875,"state":0,"selected":false},{"channel":2,"time":3.060833333333333,"oldTime":3.060833333333333,"state":true,"selected":false},{"channel":2,"time":3.341875,"oldTime":3.341875,"state":0,"selected":false},{"channel":2,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":true,"selected":false},{"channel":2,"time":3.65,"oldTime":3.65,"state":0,"selected":false},{"channel":2,"time":3.728333333333333,"oldTime":3.728333333333333,"state":true,"selected":false},{"channel":2,"time":3.8049999999999997,"oldTime":3.8049999999999997,"state":0,"selected":false},{"channel":2,"time":3.878333333333333,"oldTime":3.878333333333333,"state":true,"selected":false},{"channel":2,"time":4.139669117647059,"oldTime":4.139669117647059,"state":0,"selected":false},{"channel":2,"time":4.391544117647059,"oldTime":4.391544117647059,"state":true,"selected":false},{"channel":2,"time":4.465,"oldTime":4.465,"state":0,"selected":false},{"channel":2,"time":4.543333333333333,"oldTime":4.543333333333333,"state":true,"selected":false},{"channel":2,"time":4.62,"oldTime":4.62,"state":0,"selected":false},{"channel":2,"time":4.693333333333333,"oldTime":4.693333333333333,"state":true,"selected":false},{"channel":2,"time":4.9029131652661055,"oldTime":4.9029131652661055,"state":0,"selected":false},{"channel":2,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":2,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":2,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":2,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":2,"time":5.552079831932773,"oldTime":5.552079831932773,"state":true,"selected":false},{"channel":2,"time":6.628329831932772,"oldTime":6.628329831932772,"state":0,"selected":false}]},{"id":3,"keyframes":[{"channel":3,"time":0.99,"oldTime":0.99,"state":true,"selected":false},{"channel":3,"time":0.99,"oldTime":0.99,"state":0,"selected":false},{"channel":3,"time":1.1675,"oldTime":1.1675,"state":0,"selected":false},{"channel":3,"time":1.76,"oldTime":1.76,"state":true,"selected":false},{"channel":3,"time":1.95,"oldTime":1.95,"state":0,"selected":false},{"channel":3,"time":2.545,"oldTime":2.545,"state":true,"selected":false},{"channel":3,"time":2.7575000000000003,"oldTime":2.7575000000000003,"state":0,"selected":false},{"channel":3,"time":3.341875,"oldTime":3.341875,"state":true,"selected":false},{"channel":3,"time":3.5650000000000004,"oldTime":3.5650000000000004,"state":0,"selected":false},{"channel":3,"time":4.139669117647059,"oldTime":4.139669117647059,"state":true,"selected":false},{"channel":3,"time":4.391544117647059,"oldTime":4.391544117647059,"state":0,"selected":false},{"channel":3,"time":4.962704831932773,"oldTime":4.962704831932773,"state":true,"selected":false},{"channel":3,"time":5.068329831932773,"oldTime":5.068329831932773,"state":0,"selected":false},{"channel":3,"time":5.168329831932772,"oldTime":5.168329831932772,"state":true,"selected":false},{"channel":3,"time":5.267079831932773,"oldTime":5.267079831932773,"state":0,"selected":false},{"channel":3,"time":5.362079831932773,"oldTime":5.362079831932773,"state":true,"selected":false},{"channel":3,"time":6.628329831932772,"oldTime":6.628329831932772,"state":0,"selected":false}]}];
	
	// Fix any errors with time and oldtime
	/*for(let i = 0; i < this.tracks.length; i++) {
		let t = this.tracks[i];
		for(let j = 0; j < t.keyframes.length; j++) {
			let k = t.keyframes[j];
			k.oldTime = k.time;
		}
	}*/
	
	this.sortKeyframes();
	
	this.updateActiveTracks();
}

Timeline.sortKeyframes = function() {
	
	for(let i = 0; i < this.tracks.length; i++) {
		
		this.tracks[i].keyframes.sort(function(a, b) {
			return a.time - b.time;
		});
	}
}

Timeline.findClosestKeyframe = function(time, trackIndex, onlyBefore = false) {
	var t = this.tracks[trackIndex];
	var current = null;
	for (let i = 0; i < t.keyframes.length; i++) {
		
		var k = t.keyframes[i];
		
		if(current == null) {
			current = k;
		}
		else{
			let newdiff = Math.abs(k.time - time);
			let olddiff = Math.abs(current.time - time);
			
			if(onlyBefore && k.time > this.time) continue;
			if((newdiff < olddiff)) current = k;
		}
	}
	
	// Just make sure that we aren't going to return a keyframe after
	if(onlyBefore && (current != null) && this.time < current.time) current = null;
	
	return current;
}

Timeline.startDraggingKeyframes = function() {
	Timeline.state.draggingKeyframes = true;
}

Timeline.stopDraggingKeyframes = function() {
	Timeline.keyframeDragStartX = -1;
	Timeline.state.draggingKeyframes = false;
	for(let i = 0; i < Timeline.selectedKeyframes.length; i++) {
		Timeline.selectedKeyframes[i].oldTime = Timeline.selectedKeyframes[i].time;
	}
	Timeline.sortKeyframes();
}

Timeline.cancelDraggingKeyframes = function() {
	Timeline.keyframeDragStartX = -1;
	Timeline.state.draggingKeyframes = false;
	for(let i = 0; i < Timeline.selectedKeyframes.length; i++) {
		Timeline.selectedKeyframes[i].time = Timeline.selectedKeyframes[i].oldTime;
	}
}

Timeline.getTimeMarkerSpacing = function() {
	
	if(this.timeScale > 40) {
		return 1;
	}
	else if(this.timeScale > 20) {
		return 5;
	}
	
	return 10;
}

Timeline.getSelectedKeyframes = function() {
	var selectedKeyframes = [];
	
	for(let i = 0; i < this.tracks.length; i++) {
		var t = this.tracks[i];
		
		for(let j = 0; j < t.keyframes.length; j++) {
			if(t.keyframes[j].selected === true) {
				selectedKeyframes.push(t.keyframes[j]);
			}
		}
	}
	
	return selectedKeyframes;
}

Timeline.deleteSelectedKeyframes = function() {
	for(let i = 0; i < this.tracks.length; i++) {
		
		var t = this.tracks[i];
		var toRemove = [];
		
		for(let j = 0; j < t.keyframes.length; j++) {
			if(t.keyframes[j].selected === true) {
				toRemove.push(j);
			}
		}
		
		for(let k = toRemove.length - 1; k >= 0; k--) {
			t.keyframes.splice(toRemove[k], 1);
		}
	}
}

Timeline.duplicateKeyframes = function() {
	
	//var newKeyframes = this.getSelectedKeyframes().slice(0); //this.selectedKeyframes.slice(0);
	
	var newKeyframes = JSON.parse(JSON.stringify(this.selectedKeyframes));
	
	this.deselectAllKeyframes();
	
	for(let i = 0; i < newKeyframes.length; i++) {
		
		let k = newKeyframes[i];
		let t = k.channel;
		
		console.log("NEWKEYFRAME", k);
		
		k.selected = true;
		this.tracks[t].keyframes.push(k);
	}
	
	this.startDraggingKeyframes();
}

Timeline.deselectAllKeyframes = function() {
	for(let i = 0; i < this.tracks.length; i++) {
		
		var t = this.tracks[i];
		
		for(let j = 0; j < t.keyframes.length; j++) {
			t.keyframes[j].selected = false;
		}
	}
}

Timeline.performAlign = function() {
	
	var selectedKeyframes = [];
	var totalTime = 0;
	
	for(let i = 0; i < this.tracks.length; i++) {
		var t = this.tracks[i];
		for(let j = 0; j < t.keyframes.length; j++) {
			var k = t.keyframes[j];
			if(k.selected) {
				selectedKeyframes.push(k);
				totalTime += k.time;
			}
		}
	}
	
	var avgTime = totalTime / selectedKeyframes.length;
	
	for(let k = 0; k < selectedKeyframes.length; k++) {
		
		selectedKeyframes[k].time = avgTime;
		selectedKeyframes[k].oldTime = avgTime;
	}
}

Timeline.performKeyframeInvert = function() {
	var selected = this.selectedKeyframes;
	
	console.log(selected);
	
	for(let i = 0; i < selected.length; i++) {
		
		selected[i].state = !selected[i].state;
	}
}

Timeline.performBoxSelection = function() {
	
	var startX = this.selectionBoxStart.x;
	var startY = this.selectionBoxStart.y;
	var endX = this.selectionBoxEnd.x;
	var endY = this.selectionBoxEnd.y;
	
	for(let i = 0; i < this.tracks.length; i++) {
		var t = this.tracks[i];
		var trackY = this.getKeyframeY(i);
		// Check if we need to search this track
		//if(isInside(trackY, startY, endY)) {
			//console.log("Track", i, "is inside");
			
		for(let j = 0; j < t.keyframes.length; j++) {
			
			let k = t.keyframes[j];
			
			let tX = this.timeToX(k.time);
			
			k.selected = (isInside(tX, startX, endX) && isInside(trackY, startY, endY)) || (k.selected && this.state.holdingShift);
		}
	}
}