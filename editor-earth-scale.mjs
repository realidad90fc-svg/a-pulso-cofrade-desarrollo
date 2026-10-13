// Calibrated against a 10 m Google Earth scale bar measuring about 142 px
// in a 1606 px-wide, near-vertical capture at 106 m camera altitude.
// This is a first estimate, NOT a universal Google Earth meters-per-pixel
// conversion; tilt, field of view, camera settings and crop can change it.
export const EARTH_CALIBRATION=Object.freeze({
 referenceAltitudeM:106,referenceWidthPx:1606,referenceBarMeters:10,referenceBarPixels:142
});
export function parseEarthAltitude(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=5&&value<=3000?value:null;
 if(typeof value!=='string')return null;
 const normalized=value.trim().replace(',', '.');
 if(!/^\d+(?:\.\d+)?\s*(?:m|metros?)?$/i.test(normalized))return null;
 const altitude=Number.parseFloat(normalized);
 return Number.isFinite(altitude)&&altitude>=5&&altitude<=3000?altitude:null;
}
export function estimateEarthPhotoSize(pixelWidth,pixelHeight,altitude,calibration=EARTH_CALIBRATION){
 const h=parseEarthAltitude(altitude);
 if(!h||![pixelWidth,pixelHeight].every(n=>Number.isFinite(n)&&n>0&&n<=20000))return null;
 const pixelsPerMetreAtReference=calibration.referenceBarPixels/calibration.referenceBarMeters;
 const pixelsPerMetre=pixelsPerMetreAtReference*(pixelWidth/calibration.referenceWidthPx)*(calibration.referenceAltitudeM/h);
 return {
  width:pixelWidth/pixelsPerMetre,
  height:pixelHeight/pixelsPerMetre,
  pixelsPerMetre,
  altitude:h,
  approximate:true
 };
}
