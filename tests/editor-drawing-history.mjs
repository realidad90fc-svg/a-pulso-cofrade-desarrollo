import assert from 'node:assert/strict';
import {DRAWING_TOOLS,appendDrawingPoint,clearDrawing,hasDrawingDraft,undoDrawingPoint,redoDrawingPoint,drawingHistoryStatus} from '../editor-drawing-history.mjs';
for(const tool of DRAWING_TOOLS){
 const state={tool,working:[],history:['saved map'],future:['saved redo']},p=[1,2];appendDrawingPoint(state,p);p[0]=100;appendDrawingPoint(state,[3,4]);appendDrawingPoint(state,[5,6]);
 assert.deepEqual(state.working,[[1,2],[3,4],[5,6]]);assert(undoDrawingPoint(state));assert.deepEqual(state.working,[[1,2],[3,4]]);assert.deepEqual(state.mouseWorld,[3,4],'The rubber-band preview does not keep the removed segment');assert(redoDrawingPoint(state));assert.deepEqual(state.working,[[1,2],[3,4],[5,6]]);
 while(undoDrawingPoint(state)){}assert(hasDrawingDraft(state));assert.equal(drawingHistoryStatus(state).canUndo,false);assert.equal(state.mouseWorld,null);assert.equal(drawingHistoryStatus(state).canRedo,true);assert.deepEqual(state.history,['saved map']);assert.deepEqual(state.future,['saved redo']);
 assert(redoDrawingPoint(state));appendDrawingPoint(state,[7,8]);assert.equal(redoDrawingPoint(state),false,'A new vertex invalidates only draft redo');assert.deepEqual(state.future,['saved redo']);clearDrawing(state);assert(!hasDrawingDraft(state));assert(drawingHistoryStatus(state).canRedo,'Saved-map redo is available again after cancelling the draft');
}
assert.equal(undoDrawingPoint({tool:'select',working:[[1,1]]}),false);assert.throws(()=>appendDrawingPoint({working:[]},[NaN,0]));
console.log('Draft history: all five drawing tools, point ownership, undo/redo down to zero, branching, cancellation and separation from saved-map history passed.');
