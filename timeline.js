
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
	this.duration = 10; // in seconds
	this.timePercent = 0; // Time in 0-1 format
	this.timeViewPosition = 0; // Time where the left of the view is
	this.timeScale = 100;
	this.timeScaleMin = 10;
	this.timeScaleMax = 400 ;
	
	this.timePanStartX = 0;
	this.timePanStartViewPosition = 0;
	
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
	this.canvas.addEventListener("mouseout", this.mouseUp);
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
		var zoomPercent = x / t.sideBarWidth;
		t.timeScale = zoomPercent * 200;
	}
	
	else if(t.state.draggingSelection) {
		t.selectionBoxEnd.x = x;
		t.selectionBoxEnd.y = y;
		
		t.performBoxSelection();
	}
	
	else if(t.state.draggingPan) {
		var deltaX = t.timePanStartX - x;
		var deltaTime = deltaX / t.timeScale;
		console.log(t.timePanStartViewPosition);
		t.timeViewPosition = Math.clamp(t.timePanStartViewPosition + deltaTime, 0, t.duration);
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
	
	if(key == KEY_G) {
		Timeline.state.draggingKeyframes = true;
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
		Timeline.state.draggingKeyframes = true;
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
		this.ctx.fillStyle = this.lineColor;
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
	this.timePercent = this.time / this.duration;
	
	// if audio is playing update our position to match
	if(wavesurfer.isPlaying()) {
		this.time = wavesurfer.getCurrentTime();
	}
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
	
	for(let i = 0; i < this.numTracks; i++){
		
		// Build frames
		var k = [new Keyframe(i, 1.5, 1)];
		
		// Build track
		var t = new Track(i, k);
		
		this.tracks.push(t);
	}
	
	console.log(this.tracks);
}

Timeline.findClosestKeyframe = function(time, trackIndex) {
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
			
			if(newdiff < olddiff) current = k;
		}
	}
	
	return current;
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