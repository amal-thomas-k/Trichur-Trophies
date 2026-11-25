// Local operator crop presets from visual inspection of the supplied source set.
// No face recognition, remote image service or invented replacement pixels.
// Focus coordinates are fractions of the original photo; zoom is relative to cover.
const overrides={
  12:[.50,.34,1.25],18:[.51,.26,1.8],26:[.49,.26,1.8],
  34:[.44,.42,1.15],35:[.50,.36,1.35],37:[.48,.41,1.1],
  38:[.57,.23,2.1],47:[.53,.23,1.9],59:[.52,.35,1.2],
  61:[.50,.36,1.2],63:[.55,.35,1.5],64:[.50,.30,1.65],
  67:[.50,.21,2.1],73:[.50,.32,1.65],74:[.53,.38,1.1],
  80:[.50,.28,1.8],82:[.55,.32,1.5],83:[.57,.36,1.3],
  84:[.50,.37,1.2],91:[.50,.42,1.1],97:[.61,.36,1.25],
  100:[.54,.33,1.35],
};
export function work1Crop(filename,width,height){
 const index=Number(filename.slice(0,3));
 const [focusX,focusY,zoom]=overrides[index]||[.5,.43,1];
 const scale=zoom/Math.min(width,height),w=width*scale,h=height*scale;
 const clamp=x=>Math.max(-1,Math.min(1,x));
 const x=w>1.00001?clamp(w*(1-2*focusX)/(w-1)):0;
 const y=h>1.00001?clamp(h*(1-2*focusY)/(h-1)):0;
 return{x,y,zoom,rotation:0};
}
