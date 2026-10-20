// 가상 기타 줄(Karplus-Strong): 처음 +sharp 센트 높다가 내려감, 음량 감쇠, 방 소음
const fs=require('fs');
function pluck({f0,sr=48000,dur=5,sharp=8,drift=0.35,peak=0.15,t60=4,noise=0.002,seed=1}){
  let s=seed;const rnd=()=>((s=(s*16807)%2147483647)/2147483647)*2-1;
  const n=Math.floor(sr*dur),out=new Float32Array(n);
  const maxD=Math.ceil(sr/f0*1.1)+4,line=new Float32Array(maxD*2);
  const P0=sr/f0;for(let i=0;i<Math.round(P0);i++)line[i]=rnd();
  // 감쇠: 한 주기마다 g, t60초에 -60dB
  const g=Math.pow(10,-3/(t60*f0));
  let w=Math.round(P0),prev=0;const buf=new Float32Array(1<<16);const M=buf.length-1;
  for(let i=0;i<Math.round(P0);i++)buf[i]=rnd();
  let pos=Math.round(P0);
  for(let i=0;i<n;i++){
    const t=i/sr, f=f0*Math.pow(2,sharp*Math.exp(-t/drift)/1200);
    const D=sr/f-0.5; // 평균필터 지연 보정
    const rp=pos-D, i0=Math.floor(rp), fr=rp-i0;
    const a=buf[i0&M]*(1-fr)+buf[(i0+1)&M]*fr;
    const y=g*0.5*(a+prev);prev=a;
    buf[pos&M]=y;pos++;
    out[i]=y;
  }
  let pk=0;for(const v of out)pk=Math.max(pk,Math.abs(v));
  for(let i=0;i<n;i++)out[i]=out[i]/pk*peak+rnd()*noise*1.7;
  return out;
}
// WebAudio 기본 lowpass (Q=1dB 근사 → RBJ Q≈1.12)
function lowpass(x,sr,fc){const w=2*Math.PI*fc/sr,Q=Math.pow(10,1/20),al=Math.sin(w)/(2*Q),c=Math.cos(w);
 const b0=(1-c)/2/(1+al),b1=(1-c)/(1+al),a1=-2*c/(1+al),a2=(1-al)/(1+al);let x1=0,x2=0,y1=0,y2=0;const y=new Float32Array(x.length);
 for(let i=0;i<x.length;i++){const v=b0*x[i]+b1*x1+b0*x2-a1*y1-a2*y2;x2=x1;x1=x[i];y2=y1;y1=v;y[i]=v}return y}
module.exports={pluck,lowpass};
