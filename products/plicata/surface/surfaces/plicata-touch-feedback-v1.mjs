import {createControlVisualScheduler} from './continuous-control-gesture-v1.mjs'

// The contact marker describes the physical finger, not the mapped Y value or
// pitch-bend origin. In particular a legato handoff may inherit sound expression
// without inheriting the previous key's visual contact position.
export function createPlicataTouchFeedback({stage,keys,heldOffsetY=1}){
  let geometry=null,destroyed=false
  const painters=new Map(),markers=new Map()
  const invalidate=()=>{geometry=null}
  const measure=()=>{
    geometry=keys.map(key=>{
      const rect=key.getBoundingClientRect(),width=key.offsetWidth,height=key.offsetHeight
      const sx=rect.width/Math.max(1,width),sy=rect.height/Math.max(1,height)
      return {left:rect.left,top:rect.top-(key.classList.contains('is-held')?heldOffsetY*sy:0),
        width:rect.width,height:rect.height,sx,sy,clientWidth:key.clientWidth,clientHeight:key.clientHeight,
        borderX:key.clientLeft,borderY:key.clientTop}
    })
    return geometry
  }
  const rect=index=>{
    const row=(geometry||measure())[index]
    if(!row)return null
    const top=row.top+(keys[index].classList.contains('is-held')?heldOffsetY*row.sy:0)
    return {...row,top,right:row.left+row.width,bottom:top+row.height}
  }
  const prepare=index=>{
    if(markers.has(index))return
    const marker=keys[index]?.querySelector('.mav-serpentine-key__touch')
    if(!marker)return
    markers.set(index,marker)
    // Keep the original dot/shadow; only its positioning mechanism changes.
    Object.assign(marker.style,{left:'0px',top:'0px',willChange:'transform, opacity'})
    marker.dataset.contactPosition='physical-pointer-v1'
    painters.set(index,createControlVisualScheduler((_key,x,y)=>{
      if(destroyed)return
      const transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`
      if(marker.style.transform!==transform)marker.style.transform=transform
    }))
  }
  const paint=(index,event)=>{
    if(!event||!Number.isFinite(Number(event.clientX))||!Number.isFinite(Number(event.clientY)))return
    prepare(index)
    const r=rect(index);if(!r||r.width<=0||r.height<=0)return
    const x=Math.max(0,Math.min(r.clientWidth,(Number(event.clientX)-r.left)/r.sx-r.borderX))
    const y=Math.max(0,Math.min(r.clientHeight,(Number(event.clientY)-r.top)/r.sy-r.borderY))
    painters.get(index)?.push('contact',x,y)
  }
  const candidateAt=(x,y,fromIndex)=>{
    for(let index=0;index<keys.length;index++){
      if(index===fromIndex)continue
      const r=rect(index)
      if(r&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return index
    }
    return -1
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(invalidate):null
  observer?.observe(stage)
  globalThis.addEventListener?.('resize',invalidate,{passive:true})
  globalThis.addEventListener?.('scroll',invalidate,{passive:true,capture:true})
  globalThis.addEventListener?.('plicata-performance-mode-changed',invalidate)
  globalThis.visualViewport?.addEventListener?.('resize',invalidate,{passive:true})
  return {prepare,rect,paint,candidateAt,invalidate,
    begin(){if(!geometry)measure()},
    release(index){painters.get(index)?.cancel()},
    destroy(){destroyed=true;for(const painter of painters.values())painter.cancel();observer?.disconnect();
      globalThis.removeEventListener?.('resize',invalidate);globalThis.removeEventListener?.('scroll',invalidate,true);
      globalThis.removeEventListener?.('plicata-performance-mode-changed',invalidate);
      globalThis.visualViewport?.removeEventListener?.('resize',invalidate);geometry=null;painters.clear();markers.clear()}
  }
}
