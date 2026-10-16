// Draft vertices are transient editor state, separate from saved-map undo.
export const DRAWING_TOOLS=new Set(['road','sidewalk','house','hole','collision-draw']);
export const isDrawingTool=tool=>DRAWING_TOOLS.has(tool);
export const hasDrawingDraft=state=>isDrawingTool(state.tool)&&!!(state.working?.length||state.workingFuture?.length);
export function appendDrawingPoint(state,point){
 if(!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite))throw Error('Punto de trazado no válido.');
 state.working??=[];state.working.push(point.slice(0,2));state.workingFuture=[];
}
export function clearDrawing(state){state.working=[];state.workingFuture=[]}
export function undoDrawingPoint(state){if(!isDrawingTool(state.tool)||!state.working?.length)return false;state.workingFuture??=[];state.workingFuture.push(state.working.pop());return true}
export function redoDrawingPoint(state){if(!isDrawingTool(state.tool)||!state.workingFuture?.length)return false;state.working??=[];state.working.push(state.workingFuture.pop());return true}
export function drawingHistoryStatus(state){const draft=hasDrawingDraft(state);return{draft,points:state.working?.length||0,removed:state.workingFuture?.length||0,canUndo:!!(draft?state.working?.length:state.history?.length),canRedo:!!(draft?state.workingFuture?.length:state.future?.length)}}
