export function extractMoogMidiLearnCc(input,config,afterSequence=0){
  const mpe=['MPE_LOWER','MPE_UPPER'].includes(String(config?.mode||''))
  const master=Math.max(1,Math.min(16,Number(config?.masterChannel)||1))
  const rawTimbreCc=Number(config?.timbreCc),timbreCc=Math.max(0,Math.min(127,Number.isFinite(rawTimbreCc)?rawTimbreCc:74))
  const accepts=status=>{
    if(!Number.isFinite(status)||((status&0xF0)!==0xB0))return false
    const channel=(status&0x0F)+1
    return !mpe||channel===master
  }
  let learned=null
  for(const event of Array.isArray(input?.events)?input.events:[]){
    const sequence=Number(event?.sequence||0),bytes=Array.isArray(event?.bytes)?event.bytes:[],status=Number(bytes[0])
    if(sequence<=afterSequence||bytes.length<3||!accepts(status))continue
    const channel=(status&0x0F)+1,cc=Number(bytes[1])&0x7F
    if(cc>=120)continue
    if(mpe&&channel!==master&&cc===timbreCc)continue
    learned={cc,sequence,status}
  }
  const latest=Math.max(0,Number(input?.latestSequence||input?.parsedCount||0))
  if(!learned&&latest>afterSequence){
    const status=Number(input?.lastStatus)
    if(accepts(status)){
      const channel=(status&0x0F)+1,cc=Number(input?.lastData1)&0x7F
      if(cc<120&&!(mpe&&channel!==master&&cc===timbreCc))learned={cc,sequence:latest,status}
    }
  }
  return learned
}
