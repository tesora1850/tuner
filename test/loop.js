// 튜너 파이프라인을 프레임 단위로 돌려서 시간별 표시값을 찍는다
const fs=require('fs');const {pluck,lowpass}=require('./sim');
const src=fs.readFileSync(process.argv[2],'utf8');
eval(src.split('// YIN-START')[1].split('// YIN-END')[0]+';global.yin=yin;'+(src.includes('// TRACK-START')?src.split('// TRACK-START')[1].split('// TRACK-END')[0]+';global.makeTracker=makeTracker':''));
const sr=48000,N=8192,hop=+(process.env.HOP||800); // 60fps에서 2프레임마다 = 약 33ms
const hz=m=>440*2**((m-69)/12);
const STR=[40,45,50,55,59,64];const fMin=hz(40)*0.8;
function run(name,opt,verbose){
  const f0=hz(opt.midi);const x=lowpass(pluck({...opt,f0,sr}),sr,1500);
  const d=new Float32Array(N);let hist=[],out=[];
  let tracker=global.makeTracker?makeTracker({sr,N}):null;
  for(let end=N;end<=x.length;end+=hop){
    const b=x.subarray(end-N,end);const t=end/sr;
    const trueC=opt.sharp*Math.exp(-t/(opt.drift||0.35));
    let f=null;
    if(tracker){f=tracker.push(b,fMin);}
    else{ // 현재 코드 그대로
      let rms=0;for(let i=N>>1;i<N;i++)rms+=b[i]*b[i];rms=Math.sqrt(rms/(N>>1));
      if(rms>=0.006){const r=yin(b,sr,d,fMin);if(r){
        if(hist.length&&Math.abs(Math.log2(r.f/hist[hist.length-1]))>0.05)hist.length=0;
        hist.push(r.f);if(hist.length>7)hist.shift();
        if(hist.length>=3){const s=[...hist].sort((a,b)=>a-b);f=s[s.length>>1]}}}
    }
    let str=null,c=null;if(f){const mf=69+12*Math.log2(f/440);let k=0;STR.forEach((s,i)=>{if(Math.abs(s-mf)<Math.abs(STR[k]-mf))k=i});str=6-k;c=(mf-STR[k])*100}
    out.push({t,trueC,str,c});
  }
  const want=6-STR.indexOf(opt.midi);
  let oracle=0;for(let end=N;end<=x.length;end+=hop){const r=yin(x.subarray(end-N,end),sr,d,fMin);const t=end/sr;const tc=opt.sharp*Math.exp(-t/(opt.drift||0.35));if(r&&Math.abs(1200*Math.log2(r.f/f0)-tc)<3)oracle=t}
  const shown=out.filter(o=>o.str!==null),right=shown.filter(o=>o.str===want&&Math.abs(o.c-o.trueC)<3);
  const lastRight=right.length?right[right.length-1].t:0;
  console.log(`${name.padEnd(22)} 표시된 비율 ${(shown.length/out.length*100).toFixed(0).padStart(3)}%  맞게 표시 ${(right.length/out.length*100).toFixed(0).padStart(3)}%  마지막 정상표시 ${lastRight.toFixed(2)}s / 들을 수 있던 끝 ${oracle.toFixed(2)}s  틀린줄 ${shown.filter(o=>o.str!==want).length}`);
  if(verbose)for(const o of out.filter((_,i)=>i%6==0))console.log('  ',o.t.toFixed(2),'실제',o.trueC.toFixed(1),'표시',o.str?`${o.str}번 ${o.c.toFixed(1)}`:'—');
  return {right:Math.min(1,lastRight/oracle),lastRight};
}
const V=process.argv[3]==='-v';
const cases=[
 ['1번 E4 보통',{midi:64,peak:0.15,t60:3,sharp:8}],
 ['1번 E4 작게',{midi:64,peak:0.05,t60:3,sharp:8}],
 ['2번 B3 보통',{midi:59,peak:0.15,t60:4,sharp:8}],
 ['3번 G3 보통',{midi:55,peak:0.15,t60:5,sharp:8}],
 ['6번 E2 보통',{midi:40,peak:0.15,t60:7,sharp:8}],
 ['6번 E2 작게',{midi:40,peak:0.05,t60:7,sharp:8}],
 ['1번 E4 조용한방',{midi:64,peak:0.08,t60:4,sharp:10,noise:0.0005}],
 ['5번 A2 조용한방',{midi:45,peak:0.08,t60:6,sharp:10,noise:0.0005}],
];
let worst=1;for(const [n,o] of cases){const r=run(n,{dur:5,...o},V);worst=Math.min(worst,r.right)}
console.log('가장 나쁜 경우: 들을 수 있던 시간의',(worst*100).toFixed(0)+'% 까지 표시');console.log(worst<0.85?'RED: 표시 구간이 짧음':'GREEN');
