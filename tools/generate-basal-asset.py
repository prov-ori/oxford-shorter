"""CC0 MRI context for an educational basal-ganglia model. No invented STN/SN segmentation."""
import argparse,hashlib,json,struct
from pathlib import Path
import numpy as np
import nibabel as nib
from scipy import ndimage
from skimage.measure import marching_cubes
import fast_simplification
ap=argparse.ArgumentParser();ap.add_argument('--input',type=Path,required=True);ap.add_argument('--root',type=Path,required=True);args=ap.parse_args()
sources=json.loads((args.input/'sources.json').read_text());used=[s for s in sources if Path(s['path']).name in ['lh.pial.T1','rh.pial.T1','aseg.mgz']]
for s in used:
 if hashlib.sha256((args.input/Path(s['path']).name).read_bytes()).hexdigest()!=s['sha256']:raise ValueError('Checksum '+s['path'])
vertices=[];faces=[];parts=[];sides=[];stats=[]
def append(v,f,part,side,name):
 v=v[:,[0,2,1]];f=f[:,[0,2,1]];offset=sum(len(x) for x in vertices);vertices.append(v);faces.append(f+offset);parts.append(np.full(len(f),part,dtype='u1'));sides.append(np.full(len(f),side,dtype='u1'));stats.append({'name':name,'part':part,'side':side,'center':np.mean(v,axis=0).tolist(),'triangles':len(f)})
for side,hemi in enumerate(['lh','rh']):
 v,f=nib.freesurfer.read_geometry(str(args.input/(hemi+'.pial.T1')));v,f=fast_simplification.simplify(v,f.astype(np.int32),target_count=5000,agg=5);append(v,f,1,side,hemi+' cortex context')
image=nib.load(str(args.input/'aseg.mgz'));data=np.asarray(image.dataobj);transform=image.header.get_vox2ras_tkr()
for part,name,labels in [(2,'caudate',[11,50]),(3,'putamen',[12,51]),(4,'pallidum combined',[13,52]),(5,'thalamus',[10,49])]:
 for side,label in enumerate(labels):
  mask=data==label;coords=np.argwhere(mask);lo=np.maximum(coords.min(0)-3,0);hi=np.minimum(coords.max(0)+4,data.shape);crop=mask[tuple(slice(a,b) for a,b in zip(lo,hi))];smoothed=ndimage.gaussian_filter(crop.astype(np.float32),.5);v,f,_,_=marching_cubes(smoothed,.5,allow_degenerate=False);v=nib.affines.apply_affine(transform,v+lo)
  if len(f)>1500:v,f=fast_simplification.simplify(v,f.astype(np.int32),target_count=1500,agg=5)
  append(v,f,part,side,('left ' if side==0 else 'right ')+name)
v=np.concatenate(vertices);f=np.concatenate(faces);p=np.concatenate(parts);h=np.concatenate(sides);q=np.round(v*10).astype('<i2')
if len(v)>=65536 or f.min()<0 or f.max()>=len(v):raise ValueError('Invalid indices')
if np.max(np.abs(v-q/10))>.051:raise ValueError('Quantization overflow')
crosses=np.cross(q[f[:,1]].astype(np.int32)-q[f[:,0]],q[f[:,2]].astype(np.int32)-q[f[:,0]]);valid=np.any(crosses!=0,axis=1);f=f[valid];p=p[valid];h=h[valid]
for row in stats:row['triangles']=int(np.count_nonzero((p==row['part'])&(h==row['side'])))
raw=struct.pack('<4sIIIII',b'SYS1',1,len(v),len(f),2,10)+q.tobytes()+f.astype('<u2').tobytes()+p.tobytes()+h.tobytes();out=args.root/'dist/assets/basal-mri-v1.bin';out.write_bytes(raw)
meta={'schemaVersion':1,'asset':'assets/basal-mri-v1.bin','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'vertices':len(v),'triangles':len(f),'dataset':'OpenNeuro ds006128','snapshot':'1.0.11','doi':'10.18112/openneuro.ds006128.v1.0.11','license':'CC0-1.0','sourceFiles':used,'coordinateTransform':'FreeSurfer surface RAS (x,y,z) -> display (x,z,y), mm, winding reversed','quantizationMillimetres':.1,'segments':stats,'limits':['Single participant, automated aseg segmentation and simplified surfaces','Pallidum is a combined structure; GPe/GPi are not individually segmented','STN, substantia nigra, neural populations and connections are schematic overlays, not tractography or MRI-derived segmentation']}
(args.root/'content/basal-mri-provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'bytes':len(raw),'vertices':len(v),'triangles':len(f),'sha256':meta['sha256']}))
