// Calibrated with the user's Google Earth Calle Arfe photo:
// 10.58 m between street borders at 106 m camera altitude.
// A Pulso's actual Arfe roadway is 2*1.30 game units, and the authored
// sidewalk outer bounds extend another 0.25 game units on either side.
// No step dimensions, collision surfaces or native streets are altered.
//
// At altitude 106 m, a 10 m scale bar was ~142 ORIGINAL SCREEN PIXELS.
// Cropped images must retain their proportional size: DO NOT normalize
// pixel density by photo width (previous versions made every crop equally
// wide regardless of its image-pixel dimensions).
// User-approved visual correction ×1.50 after comparing Arfe at 106m and 150m.
// Approximate if the screenshot was resized, Google Earth FOV changed, or
// camera is inclined; camera altitude alone is not an exact physical scale.
export const EARTH_CALIBRATION=Object.freeze({
 referenceAltitudeM:106,referenceBarMeters:10,referenceBarPixels:142,
 streetReferenceMetres:10.58,gameRoadHalfWidth:1.30,gameSidewalkOuter:.25,
 visualScaleCorrection:1.50,
 scaleVersion:4
});
export function parseEarthAltitude(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=5&&value<=3000?value:null;
 if(typeof value!=='string')return null;
 const s=value.trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?\s*(?:m|metros?)?$/i.test(s))return null;
 const h=Number.parseFloat(s);
 return Number.isFinite(h)&&h>=5&&h<=3000?h:null;
}
export function estimateEarthPhotoSize(pixelWidth,pixelHeight,altitude,c=EARTH_CALIBRATION){
 const h=parseEarthAltitude(altitude);
 if(!h||![pixelWidth,pixelHeight].every(n=>Number.isFinite(n)&&n>0&&n<=20000))return null;
 const pixelsPerMetre=c.referenceBarPixels/c.referenceBarMeters*c.referenceAltitudeM/h;
 const gameUnitsPerMetre=(2*c.gameRoadHalfWidth+2*c.gameSidewalkOuter)/c.streetReferenceMetres*c.visualScaleCorrection;
 if(!Number.isFinite(pixelsPerMetre)||pixelsPerMetre<=0||!Number.isFinite(gameUnitsPerMetre)||gameUnitsPerMetre<=0)return null;
 return{width:pixelWidth/pixelsPerMetre*gameUnitsPerMetre,
  height:pixelHeight/pixelsPerMetre*gameUnitsPerMetre,
  pixelsPerMetre,gameUnitsPerMetre,altitude:h,
  scaleVersion:c.scaleVersion,approximate:true};
}
