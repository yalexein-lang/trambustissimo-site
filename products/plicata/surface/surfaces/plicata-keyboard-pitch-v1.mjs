export const PLICATA_PITCH_SCHEMA='plicata-keyboard-pitch-v1'

const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,Number(value)))
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback

export function resolvePlicataKeyboardPitch({sourceNote=60,transposeSemitones=0,tuningCents=0,kbScale=1,rootNote=60,bendRangeSemitones=2}={}){
  const root=finite(rootNote,60),source=clamp(Math.round(finite(sourceNote,root)),0,127),transpose=Math.round(clamp(finite(transposeSemitones,0),-24,24)),cents=clamp(finite(tuningCents,0),-100,100),scale=clamp(finite(kbScale,1),1,5),range=Math.max(.01,finite(bendRangeSemitones,2))
  const tunedNote=source+transpose+cents/100
  const exactSemitones=root+(tunedNote-root)*scale
  const midiNote=clamp(Math.round(exactSemitones),0,127)
  const residualSemitones=exactSemitones-midiNote
  const normalizedBend=clamp(residualSemitones/range,-1,1)
  const bend14=clamp(Math.round(8192+normalizedBend*8192),0,16383)
  return{schema:PLICATA_PITCH_SCHEMA,sourceNote:source,rootNote:root,transposeSemitones:transpose,tuningCents:cents,kbScale:scale,tunedNote,exactSemitones,midiNote,bendRangeSemitones:range,residualSemitones,bend14}
}

export const plicataPitchBendBytes=(pitch,channel=0)=>{const bend=clamp(Math.round(finite(pitch?.bend14,8192)),0,16383),ch=clamp(Math.round(finite(channel,0)),0,15);return[0xE0|ch,bend&0x7F,(bend>>7)&0x7F]}
export const plicataNoteOnBytes=(pitch,velocity=108,channel=0)=>{const ch=clamp(Math.round(finite(channel,0)),0,15),note=clamp(Math.round(finite(pitch?.midiNote,pitch?.sourceNote??60)),0,127),vel=clamp(Math.round(finite(velocity,108)),0,127);return[0x90|ch,note,vel]}
export const plicataNoteOffBytes=(pitch,channel=0)=>{const ch=clamp(Math.round(finite(channel,0)),0,15),note=clamp(Math.round(finite(pitch?.midiNote,pitch?.sourceNote??60)),0,127);return[0x80|ch,note,0]}
export const plicataNeutralBendBytes=(channel=0)=>{const ch=clamp(Math.round(finite(channel,0)),0,15);return[0xE0|ch,0,64]}
export const plicataPitchBendRangeMessages=(rangeSemitones=2,channel=0)=>{const ch=clamp(Math.round(finite(channel,0)),0,15),range=clamp(Math.round(finite(rangeSemitones,2)),1,24),cc=0xB0|ch;return[[cc,101,0],[cc,100,0],[cc,6,range],[cc,38,0],[cc,101,127],[cc,100,127]]}
export const plicataTwelveTetPitch=pitch=>{const exact=finite(pitch?.exactSemitones,pitch?.sourceNote??60),midiNote=clamp(Math.round(exact),0,127);return{...(pitch||{}),midiNote,residualSemitones:0,bend14:8192}}
