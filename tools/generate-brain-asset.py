"""Prepare an educational MRI-derived mesh from CC0 OpenNeuro ds006128, snapshot 1.0.11.
Offline preparation only. Requirements: numpy, scipy, nibabel, scikit-image, fast-simplification.
No participant images or full input surfaces are distributed with the site.
"""
import argparse, hashlib, json, struct
from pathlib import Path
import numpy as np
import nibabel as nib
from scipy.spatial import cKDTree
from scipy import ndimage
from skimage.measure import marching_cubes
import fast_simplification

ap=argparse.ArgumentParser();ap.add_argument('--input',type=Path,required=True);ap.add_argument('--root',type=Path,required=True);args=ap.parse_args()
sources=json.loads((args.input/'sources.json').read_text())
for s in sources:
    raw=(args.input/Path(s['path']).name).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=s['sha256']:raise ValueError('Source checksum mismatch: '+s['path'])
groups={1:('frontal','Лобные доли'),2:('parietal','Теменные доли'),3:('temporal','Височные доли'),4:('occipital','Затылочные доли'),5:('insula','Островковая кора'),6:('cerebellum','Мозжечок'),7:('stem','Ствол мозга'),8:('thalamus','Таламус'),9:('callosum','Мозолистое тело'),10:('hippocampus','Гиппокамп'),11:('amygdala','Миндалина'),12:('unlabeled','Неразмеченная поверхность')}
names={
1:'superiorfrontal rostralmiddlefrontal caudalmiddlefrontal parsopercularis parstriangularis parsorbitalis lateralorbitofrontal medialorbitofrontal precentral paracentral frontalpole caudalanteriorcingulate rostralanteriorcingulate'.split(),
2:'postcentral superiorparietal inferiorparietal supramarginal precuneus posteriorcingulate isthmuscingulate'.split(),
3:'bankssts superiortemporal middletemporal inferiortemporal fusiform transversetemporal temporalpole entorhinal parahippocampal'.split(),
4:'cuneus pericalcarine lateraloccipital lingual'.split(),5:['insula']}
vertices=[];faces=[];regions=[];stats=[]
def append_mesh(v,f,r,label):
    # Original surface RAS: right/anterior/superior -> display right/up/front.
    v=v[:,[0,2,1]];f=f[:,[0,2,1]];offset=sum(len(x) for x in vertices)
    vertices.append(v);faces.append(f+offset);regions.append(r if hasattr(r,'__len__') else np.full(len(f),r,dtype=np.uint8));stats.append({'name':label,'vertices':len(v),'triangles':len(f)})
for hemi in ['lh','rh']:
    v,f=nib.freesurfer.read_geometry(str(args.input/(hemi+'.pial.T1')))
    labels,ctab,entry_names=nib.freesurfer.read_annot(str(args.input/(hemi+'.aparc.annot')))
    lookup=np.full(len(entry_names),12,dtype=np.uint8)
    for i,name in enumerate(entry_names):
        for region,items in names.items():
            if name.decode() in items:lookup[i]=region
    original_labels=np.where(labels>=0,lookup[np.maximum(labels,0)],12)
    v2,f2=fast_simplification.simplify(v,f.astype(np.int32),target_count=20000,agg=5)
    nearest=cKDTree(v).query(v2)[1];reduced_labels=original_labels[nearest]
    triplets=reduced_labels[f2]
    voted=np.array([np.argmax(np.bincount(row,minlength=13)) for row in triplets],dtype=np.uint8)
    append_mesh(v2,f2,voted,hemi+' pial, reduced from '+str(len(f))+' faces')
volume=nib.load(str(args.input/'aseg.mgz'));data=np.asarray(volume.dataobj);transform=volume.header.get_vox2ras_tkr()
for region,values,limit in [(6,[7,8,46,47],8000),(7,[16],3000),(8,[10,49],3000),(9,[251,252,253,254,255],2000),(10,[17,53],3000),(11,[18,54],2000)]:
    mask=np.isin(data,values);coords=np.argwhere(mask)
    if not len(coords):raise ValueError('Empty segmentation '+str(region))
    lo=np.maximum(coords.min(0)-3,0);hi=np.minimum(coords.max(0)+4,data.shape)
    crop=mask[tuple(slice(a,b) for a,b in zip(lo,hi))]
    components,count=ndimage.label(crop);sizes=np.bincount(components.ravel());keep=np.where(sizes>=50)[0];keep=keep[keep!=0]
    crop=np.isin(components,keep);smoothed=ndimage.gaussian_filter(crop.astype(np.float32),.6)
    v,f,_,_=marching_cubes(smoothed,.5,allow_degenerate=False)
    v=v+lo;v=nib.affines.apply_affine(transform,v)
    if len(f)>limit:v,f=fast_simplification.simplify(v,f.astype(np.int32),target_count=limit,agg=5)
    append_mesh(v,f,region,groups[region][0])
v=np.concatenate(vertices);f=np.concatenate(faces);r=np.concatenate(regions)
if len(v)>=65536:raise ValueError('Vertex budget exceeded')
quantized=np.round(v*10).astype('<i2')
if np.max(np.abs(v-quantized/10))>.051:raise ValueError('Quantization error')
if f.min()<0 or f.max()>=len(v):raise ValueError('Invalid mesh indices')
raw=struct.pack('<4sIIIII',b'NBM2',1,len(v),len(f),2,10)+quantized.tobytes()+f.astype('<u2').tobytes()+r.astype('u1').tobytes()
out=args.root/'dist/assets/brain-mri-v2.bin';out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(raw)
metadata={'schemaVersion':1,'asset':'assets/brain-mri-v2.bin','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'vertices':len(v),'triangles':len(f),'dataset':'OpenNeuro ds006128','snapshot':'1.0.11','doi':'10.18112/openneuro.ds006128.v1.0.11','subject':'sub-01','license':'CC0-1.0','sourceRepository':'https://github.com/OpenNeuroDatasets/ds006128/tree/1.0.11','sourceFiles':sources,'coordinateTransform':'FreeSurfer surface RAS (right, anterior, superior), millimetres -> (right, up, front) = (x,z,y), face winding reversed','quantizationMillimetres':.1,'corticalAtlas':'FreeSurfer aparc / Desikan-Killiany, grouped for teaching','labelGroups':names,'regions':{str(k):{'id':v[0],'title':v[1]} for k,v in groups.items()},'processing':['quadric decimation to 20000 triangles per pial hemisphere','nearest original-vertex DK label followed by face majority vote; unknown labels retained as unknown','aseg masks: Gaussian sigma 0.6 voxels, marching cubes at 0.5, removal of components smaller than 50 voxels','subcortical mesh decimation, no arbitrary relocation or scaling of individual regions','0.1 mm coordinate quantization'],'meshes':stats,'limits':['Single participant, automated segmentation; not a normative atlas','Cortical labels and subcortical contours are simplified and may contain segmentation/decimation errors','Not suitable for diagnosis, individual lesion localisation or surgical planning']}
(args.root/'content/brain-mri-provenance.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:metadata[k] for k in ['bytes','vertices','triangles','sha256']}))
