(function(root){'use strict';
 const color='#ff2d95',rgb=[1,45/255,149/255];
 // Keep a bright minimum even on back-facing surfaces; retain shape through diffuse/specular light.
 const shader='vec3 selectionColor(float diffuse,float specular){return vec3('+rgb.map(v=>v.toFixed(5)).join(',')+')*(.82+.18*diffuse)+vec3(.025,.04,.04)*specular;}';
 function hint(n){return n('p','Ярко-розовым выделена выбранная структура. Название и описание — рядом с управлением.','neuro-selection-key');}
 root.ModelSelection=Object.freeze({color,shader,hint});
 if(root.document)root.document.documentElement.style.setProperty('--structure-selection',color);
})(globalThis);
