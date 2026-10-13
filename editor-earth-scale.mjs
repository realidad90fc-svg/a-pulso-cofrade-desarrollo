// Google Earth: reference capture at 106 m with 10 m scale bar ~142 px,
// normalized to an image 1606 px wide. Field-of-view and tilt can vary.
// The native 1.0386 x 2.15 game-unit paso NEVER changes size.
// Internal 2.2m visual reference is a calibration convention, not a
// verified measurement of the physical paso.
export const EARTH_CALIBRATION=Object.freeze({
 referenceAltitudeM:106,referenceWidthPx:1606,
 referenceBarMeters:10,referenceBarPixels:142,
 pasoWidthUnits:1.0386,pasoVisualReferenceMetres:2.2
});
export function parseEarthAltitude(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=5&&value<=3000?value:null;
 if(typeof value!=='string')return null;
 const normalized=value.trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?\s*(?:m|metros?)?$/i.test(normalized))return null;
 const h=Number.parseFloat(normalized);
 return Number.isFinite(h)&&h>=5&&h<=3000?h:null;
}
export function estimateEarthPhotoSize(pixelWidth,pixelHeight,altitude,c=EARTH_CALIBRATION){
 const h=parseEarthAltitude(altitude);
 if(!h||![pixelWidth,pixelHeight].every(n=>Number.isFinite(n)&&n>0&&n<=20000))return null;
 const pixelsPerMetre=(c.referenceBarPixels/c.referenceBarMeters)*(pixelWidth/c.referenceWidthPx)*(c.referenceAltitudeM/h);
 const gameUnitsPerMetre=c.pasoWidthUnits/c.pasoVisualReferenceMetres;
 return{width:pixelWidth/pixelsPerMetre*gameUnitsPerMetre,
  height:pixelHeight/pixelsPerMetre*gameUnitsPerMetre,
  pixelsPerMetre,gameUnitsPerMetre,altitude:h,scaleVersion:2,approximate:true};
}
