// One Ayuntamiento asset, with independent placement and facade selection.
export const AYUNTAMIENTO_ASSET=Object.freeze({id:'ayuntamiento-sevilla',size:[3,5.1],material:'cream-stone',interiors:false});
export function paintAyuntamiento({ctx,box,line,fill,hall}){
   const [hx,hy,hxx,hyy]=hall.rect,mid=(hy+hyy)/2;
   box(hall.rect,'#c9bca1');box([hx+.70,hy+.20,hxx-.18,hyy-.20],'#8e887b');
   box([hx,hy,hx+.66,hyy],'#e2d8c2');
   for(const x of [hx+.04,hx+.28,hx+.61])line([[x,hy],[x,hyy]],'#f1e4c9',.045);
   for(let y=hy+.24;y<hyy-.15;y+=.48){
    box([hx+.33,y,hx+.53,y+.24],'#34443f');box([hx+.04,y,hx+.22,y+.24],'#3b4840');
    line([[hx+.01,y-.055],[hx+.65,y-.055]],'#f5e8cb',.06);
    box([hx+.04,y-.08,hx+.13,y-.045],'#b29e7c');box([hx+.53,y-.08,hx+.62,y-.045],'#b29e7c');
   }
   // Symmetrical central entrance, columns, balcony and pediment.
   box([hx,mid-.48,hx+.66,mid+.48],'#ece0c2');box([hx+.12,mid-.27,hx+.38,mid+.27],'#27332d');
   for(const y of [mid-.40,mid+.32])box([hx+.04,y,hx+.46,y+.08],'#c7b58e');
   fill([[hx+.50,mid-.53],[hx+.73,mid],[hx+.50,mid+.53]],'#e5d4ae');
   line([[hx+.50,mid-.53],[hx+.73,mid],[hx+.50,mid+.53]],'#a89a7d',.04);
   line([[hx+.34,mid-.34],[hx+.34,mid+.34]],'#4b5349',.035);
   for(const [y,color]of [[mid-.15,'#c4a541'],[mid,'#9a3332'],[mid+.15,'#54865d']]){line([[hx+.42,y],[hx+.67,y]],'#655a43',.012);fill([[hx+.51,y],[hx+.68,y],[hx+.64,y-.10],[hx+.49,y-.10]],color);}
}

// The existing building's second exterior, reused by San Francisco.
export function paintAyuntamientoSanFrancisco({ctx,box,line,fill,hall}){
   // Additional plateresque side of the SAME Ayuntamiento asset, seen from
   // San Francisco instead of the neoclassical Plaza Nueva frontage.
   const [x,y,xx,yy]=hall.rect;box([x,y,xx,y+.65],'#ccb999');for(let q=x+.12;q<xx-.15;q+=.36){box([q,y+.15,q+.17,y+.40],'#26362f');line([[q-.03,y+.06],[q+.23,y+.06]],'#ead4ac',.05);box([q-.05,y+.44,q+.22,y+.52],'#bda37b');}box([x+1.05,y,x+1.83,y+.55],'#e6cfaa');box([x+1.25,y+.06,x+1.6,y+.34],'#23312c');
}
