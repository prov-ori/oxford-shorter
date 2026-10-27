(function(root){'use strict';
 const check=(x,min,max,name='Параметр')=>{if(!Number.isFinite(x)||x<min||x>max)throw Error(name+': вне диапазона');return x;};
 const trap=(x,k)=>Math.abs(x/k)<1e-6?k*(1-x/(2*k)):x/Math.expm1(x/k);
 function rates(v){return{am:.1*trap(-(v+40),10),bm:4*Math.exp(-(v+65)/18),ah:.07*Math.exp(-(v+65)/20),bh:1/(1+Math.exp(-(v+35)/10)),an:.01*trap(-(v+55),10),bn:.125*Math.exp(-(v+65)/80)};}
 function resting(v=-65){const r=rates(v);return[v,r.am/(r.am+r.bm),r.ah/(r.ah+r.bh),r.an/(r.an+r.bn)];}
 const HH={capacitance:1,gNa:120,gK:36,gL:.3,eNa:50,eK:-77,eL:-54.387,temperature:6.3};
 function hhDerivative(s,current,na=1,k=1){const[v,m,h,n]=s,r=rates(v),iNa=HH.gNa*na*m*m*m*h*(v-HH.eNa),iK=HH.gK*k*n**4*(v-HH.eK),iL=HH.gL*(v-HH.eL);return[current-iNa-iK-iL,r.am*(1-m)-r.bm*m,r.ah*(1-h)-r.bh*h,r.an*(1-n)-r.bn*n];}
 function hh({current=20,duration=1,interval=12,sodium=1,potassium=1,dt=.01,total=50}={}){
  check(current,0,100);check(duration,.1,5);check(interval,.2,30);check(sodium,0,1);check(potassium,0,1);check(dt,.001,.02);check(total,10,150);
  let s=resting(),lastV=s[0];const trace=[],spikes=[],start=5,second=start+interval;let atSecond=null;
  const input=t=>current*((t>=start&&t<start+duration?1:0)+(t>=second&&t<second+duration?1:0));
  const add=(a,b,f)=>a.map((x,i)=>x+b[i]*f);
  for(let i=0;i<=Math.round(total/dt);i++){const t=i*dt;if(t>=second&&atSecond===null)atSecond={v:s[0],m:s[1],h:s[2],n:s[3]};if(i%5===0){const[v,m,h,n]=s;trace.push({t,v,m,h,n,iNa:HH.gNa*sodium*m**3*h*(v-HH.eNa),iK:HH.gK*potassium*n**4*(v-HH.eK),iLeak:HH.gL*(v-HH.eL),input:input(t)});}const a=hhDerivative(s,input(t),sodium,potassium),b=hhDerivative(add(s,a,dt/2),input(t+dt/2),sodium,potassium),c=hhDerivative(add(s,b,dt/2),input(t+dt/2),sodium,potassium),d=hhDerivative(add(s,c,dt),input(t+dt),sodium,potassium);s=s.map((x,j)=>x+dt*(a[j]+2*b[j]+2*c[j]+d[j])/6);if(!s.every(Number.isFinite)||s[0]<-150||s[0]>150)throw Error('Неустойчивый расчёт HH');if(lastV<0&&s[0]>=0)spikes.push(t+dt);lastV=s[0];}
  return{trace,points:trace.map(p=>[p.t,p.v]),spikes,atSecond,overlap:interval<duration,parameters:HH,dt};
 }
 function synapse({calcium=1,frequency=20,pulses=4,kind='chemical',coupling=3,source=0,dt=.05}={}){
  check(calcium,0,2);check(frequency,5,80);check(pulses,1,8);check(coupling,0,10);check(dt,.01,.1);if(!['chemical','electrical'].includes(kind)||![0,1].includes(source))throw Error('Неизвестный тип контакта');
  const times=Array.from({length:pulses},(_,i)=>20+i*1000/frequency),end=times.at(-1)+100,events=[],trace=[];let next=0,reserve=1,v1=-65,v2=-65,rise=0,decay=0;
  const probability=.6*(calcium**4/(calcium**4+.5**4));
  for(let i=0;i<=Math.ceil(end/dt);i++){const t=i*dt;reserve=1-(1-reserve)*Math.exp(-dt/180);if(next<times.length&&t+dt/2>=times[next]){const released=reserve*probability;reserve-=released;rise+=released;decay+=released;events.push({t:times[next],released,reserve});next++;}rise*=Math.exp(-dt/.5);decay*=Math.exp(-dt/6);const g=kind==='chemical'?8*Math.max(0,decay-rise):0;
   if(kind==='chemical'){v1=-65;v2+=dt*(-5*(v2+65)-g*v2)/100;}else{const injection=times.some(start=>t>=start&&t<start+2)?250:0,old1=v1,old2=v2;v1+=dt*(-5*(old1+65)-coupling*(old1-old2)+(source===0?injection:0))/100;v2+=dt*(-5*(old2+65)-coupling*(old2-old1)+(source===1?injection:0))/100;}
   if(i%4===0)trace.push({t,v1,v2,g,reserve});
  }return{trace,events,releaseProbability:probability,kind,units:'ms, mV, nS; expected vesicle fraction'};
 }
 function receptor({family='ion',chloride=8,voltage=-65,present=true,conductance=5}={}){
  check(chloride,2,60);check(voltage,-90,-35);check(conductance,0,20);if(!['ion','meta'].includes(family))throw Error('Неизвестное семейство');
  const eCl=-8.314462618*310.15/96485.33212*1000*Math.log(120/chloride),eRev=family==='ion'?eCl:-90,trace=[];let v=voltage,r=0,signal=0;
  for(let i=0;i<=6000;i++){const t=i*.1,ligand=present&&t>=20&&t<80?1:0;r+=.1*(.08*ligand*(1-r)-.02*r);signal+=.1*(.005*r*(1-signal)-.0015*signal);const g=conductance*(family==='ion'?r:signal);v+=.1*(-5*(v-voltage)-g*(v-eRev))/100;if(i%5===0)trace.push({t,v,g,occupancy:r,signal,current:g*(v-eRev)});}
  return{trace,eCl,eRev,rest:voltage,peakConductance:Math.max(...trace.map(p=>p.g)),direction:Math.abs(eRev-voltage)<.5?'shunting':eRev>voltage?'depolarizing':'hyperpolarizing',inputResistanceBefore:200,inputResistanceDuring:1000/(5+Math.max(...trace.map(p=>p.g)))};
 }
 function transmitter({frequency=20,uptakeBlock=0,enzymeBlock=0,calcium=true,molecule='dopamine',terminals=1,total=1000,dt=.1}={}){
  check(frequency,1,80);check(uptakeBlock,0,1);check(enzymeBlock,0,1);check(terminals,0,1);check(total,100,2000);check(dt,.02,.2);
  const profiles={dopamine:[.08,4,.04,1],serotonin:[.06,3,.035,1],gaba:[.07,4,.05,.3],glutamate:[.09,6,.06,0],ach:[.08,0,.6,0]};if(!profiles[molecule])throw Error('Неизвестный медиатор');const[synthesis,vmax,clearRate,returnFraction]=profiles[molecule];
  let cyt=15*terminals,vesicles=80*terminals,cleft=0,removed=0,synthesized=0,next=50;const initial=cyt+vesicles,trace=[],events=[];
  for(let i=0;i<=Math.ceil(total/dt);i++){const t=i*dt,produced=synthesis*terminals*dt,pack=Math.min(cyt,.04*cyt*Math.max(0,1-vesicles/Math.max(.001,100*terminals))*dt),uptake=Math.min(cleft,vmax*(['dopamine','serotonin'].includes(molecule)?terminals:molecule==='gaba'?.3*terminals+.7:1)*(1-uptakeBlock)*cleft/(8+cleft)*dt),clear=Math.min(Math.max(0,cleft-uptake),clearRate*(molecule==='ach'?1-enzymeBlock:1)*cleft*dt),cytLoss=Math.min(cyt,.002*cyt*dt);cyt+=produced-pack+uptake*returnFraction-cytLoss;vesicles+=pack;cleft-=uptake+clear;removed+=clear+uptake*(1-returnFraction)+cytLoss;synthesized+=produced;
   if(t+dt/2>=next){const release=calcium?.18*vesicles:0;vesicles-=release;cleft+=release;events.push({t:next,release});next+=1000/frequency;}
   if(i%10===0)trace.push({t,cyt,vesicles,cleft,removed,synthesized});
  }const balance=cyt+vesicles+cleft+removed-initial-synthesized;return{trace,events,balance,initial,final:{cyt,vesicles,cleft,removed,synthesized},profile:molecule};
 }
 function cable({distance=300,diameter=1,membraneResistance=10000,axialResistance=150}={}){check(distance,0,1500);check(diameter,.2,10);check(membraneResistance,1000,40000);check(axialResistance,50,500);const lambda=Math.sqrt(diameter/10000*membraneResistance/(4*axialResistance))*10000;return{lambda,attenuation:Math.exp(-distance/lambda),tau:membraneResistance/1000,profile:Array.from({length:101},(_,i)=>[i*15,10*Math.exp(-i*15/lambda)])};}
 function occupancy({agonist=1,partial=0,antagonist=0,kd=1,efficacy=.4}={}){check(agonist,0,100);check(partial,0,100);check(antagonist,0,100);check(kd,.1,10);check(efficacy,0,1);const a=agonist,p=partial/kd,b=antagonist/kd,z=1+a+p+b;return{full:a/z,partial:p/z,antagonist:b/z,free:1/z,response:(a+efficacy*p)/z};}
 function circuit({excitation=6,inhibition=2,synchronous=true,inhibitoryReversal=-75,weight=4,dt=.05}={}){check(excitation,0,12);check(inhibition,0,12);check(inhibitoryReversal,-85,-55);check(weight,.5,8);check(dt,.01,.1);let v=-65,gE=0,gI=0,refractory=0;const trace=[],spikes=[],events=[];for(let k=0;k<4;k++){for(let n=0;n<excitation;n++)events.push({t:20+k*60+(synchronous?0:n*3),type:'e'});for(let n=0;n<inhibition;n++)events.push({t:20+k*60,type:'i'});}events.sort((a,b)=>a.t-b.t);let next=0;for(let i=0;i<=Math.round(280/dt);i++){const t=i*dt;gE*=Math.exp(-dt/5);gI*=Math.exp(-dt/10);while(next<events.length&&events[next].t<=t+dt/2){if(events[next].type==='e')gE+=weight;else gI+=weight;next++;}const iE=gE*(v-0),iI=gI*(v-inhibitoryReversal);if(t<refractory)v=-65;else{v+=dt*(-10*(v+65)-iE-iI)/200;if(v>=-50){spikes.push(t);v=-65;refractory=t+2;}}if(i%4===0)trace.push({t,v,gE,gI,iE,iI});}return{trace,spikes,events,threshold:-50,capacitance:200};}
 function myelin({damage=0,leak=4,extent=2,dt=.0025,total=45}={}){check(damage,0,1);check(leak,.1,20);check(extent,1,8);check(dt,.001,.004);check(total,10,80);const count=25,v=new Float64Array(count).fill(-65),m=new Float64Array(count),h=new Float64Array(count),n=new Float64Array(count),init=resting();m.fill(init[1]);h.fill(init[2]);n.fill(init[3]);const trace=[],arrivals=new Array(count).fill(null),dV=new Float64Array(count),axial=4;
  for(let step=0;step<=Math.round(total/dt);step++){const t=step*dt;for(let j=0;j<count;j++){const node=j%3===0,lesion=j>=10&&j<10+extent,loss=lesion?damage:0,c=node?1:.06+.94*loss,gL=node?.3:.003+leak*loss,eL=node?-54.387:-65,active=node?120:0,r=rates(v[j]);m[j]=r.am/(r.am+r.bm)+(m[j]-r.am/(r.am+r.bm))*Math.exp(-(r.am+r.bm)*dt);h[j]=r.ah/(r.ah+r.bh)+(h[j]-r.ah/(r.ah+r.bh))*Math.exp(-(r.ah+r.bh)*dt);n[j]=r.an/(r.an+r.bn)+(n[j]-r.an/(r.an+r.bn))*Math.exp(-(r.an+r.bn)*dt);const coupled=axial*((j>0?v[j-1]-v[j]:0)+(j<count-1?v[j+1]-v[j]:0)),stim=j===0&&t>=2&&t<3?80:0;dV[j]=(coupled+stim-active*m[j]**3*h[j]*(v[j]-50)-(node?36:0)*n[j]**4*(v[j]+77)-gL*(v[j]-eL))/c;}
   for(let j=0;j<count;j++){const before=v[j];v[j]+=dt*dV[j];if(!Number.isFinite(v[j])||Math.abs(v[j])>200)throw Error('Неустойчивый кабельный расчёт');if(before<0&&v[j]>=0&&arrivals[j]===null)arrivals[j]=t;}if(step%40===0)trace.push({t,voltage:Array.from(v)});
  }return{trace,arrivals,count,conducts:arrivals.at(-1)!==null,delay:arrivals.at(-1)!==null&&arrivals[0]!==null?arrivals.at(-1)-arrivals[0]:null,axial,dt};}
 root.Biophysics={HH,rates,resting,hh,synapse,receptor,transmitter,cable,occupancy,circuit,myelin};if(typeof module!=='undefined')module.exports=root.Biophysics;
})(globalThis);
