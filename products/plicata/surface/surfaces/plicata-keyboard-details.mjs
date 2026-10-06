// Presentation-only progressive disclosure. Musical controls retain their listeners.
export function installKeyboardDetails(shell) {
  const row=shell.querySelector('.mav-keyboard-control-row'),presets=shell.querySelector('.mav-keyboard-presets'),sub=shell.querySelector('.mav-sub-strip'),arp=shell.querySelector('.mav-arp-strip'),meta=shell.querySelector('.mav-keyboard-meta'),globals=shell.querySelector('.mav-keyboard-global-controls');
  if(!row||!presets||!sub||!arp||!globals)return null;
  const subPanel=sub.querySelector('.mav-sub-detail'),subTrigger=sub.querySelector('.mav-sub-detail-toggle'),arpTrigger=arp.querySelector('[aria-label="Open advanced arpeggiator controls"]');
  if(!subPanel||!subTrigger||!arpTrigger)return null;
  const keyTrigger=document.createElement('button');keyTrigger.type='button';keyTrigger.className='experiment-more-button';keyTrigger.innerHTML='<span>KEY</span><b>MORE ▾</b>';keyTrigger.setAttribute('aria-label','Open keyboard detail controls');keyTrigger.setAttribute('aria-expanded','false');
  const keyPanel=document.createElement('section');keyPanel.className='experiment-detail-panel experiment-key-detail';keyPanel.dataset.plicataPanel='keyboard';keyPanel.hidden=true;keyPanel.setAttribute('role','region');keyPanel.setAttribute('aria-label','Keyboard detail controls');
  const keyGrid=document.createElement('div');keyGrid.className='experiment-detail-grid';keyPanel.append(keyGrid);document.body.append(keyPanel);presets.append(keyTrigger);
  const entries=[];
  const remember=(node,destination)=>{const marker=document.createComment('plicata responsive control position');node.before(marker);entries.push({node,marker,destination})};
  const presetCells=Array.from(presets.querySelectorAll(':scope>.mav-keyboard-preset'));
  for(const cell of presetCells.slice(3))remember(cell,keyGrid); // MIDI OUT and PB RANGE; X LIMIT stays on the primary row.
  remember(globals,keyGrid);
  // SUB OCT and SUB WAVE stay in the primary strip with their original bindings.
  const arpSecondary=Array.from(arp.children).filter(n=>n.querySelector?.('.mbs-label')?.textContent==='OCT');
  for(const node of arpSecondary)node.dataset.experimentSecondary='1';
  const arpInlineDuplicates=Array.from(arp.children).filter(node=>['RATE','MODE'].includes(node.querySelector?.('.mbs-label')?.textContent?.trim()));
  for(const node of arpInlineDuplicates)node.classList.add('experiment-inline-duplicate');
  const subAnchor=document.createComment('plicata responsive SUB panel position');subPanel.before(subAnchor);subPanel.dataset.plicataPanel='sub';
  // Full PERF exposes the original nodes in an inline deck. Compact views keep
  // their existing disclosure; no control or musical state is duplicated.
  const deck=document.createElement('section');deck.className='experiment-perf-deck';deck.hidden=true;deck.setAttribute('aria-label','Performance detail controls');meta.after(deck);
  const group=(name,cls)=>{const n=document.createElement('section');n.className=`experiment-perf-group ${cls}`;const label=document.createElement('strong');label.className='experiment-perf-heading';label.textContent=name;const body=document.createElement('div');body.className='experiment-perf-group-body';n.append(label,body);deck.append(n);return body};
  const inlineKey=group('KEYBOARD · MIDI / PITCH','experiment-perf-key'),inlineSub=group('INTERVAL SUB','experiment-perf-sub'),inlinePlay=group('ARPEGGIATOR · PLAY','experiment-perf-play');
  const expandedEntries=[];const rememberExpanded=(node,destination)=>{if(!node)return;const marker=document.createComment('plicata inline performance control position');node.before(marker);expandedEntries.push({node,marker,destination})};
  for(const item of entries)rememberExpanded(item.node,inlineKey);
  for(const node of [...subPanel.children])rememberExpanded(node,inlineSub);
  const playMonitor=arp.querySelector('.mav-arp-play-monitor'),advanced=arp.querySelector('.mav-arp-advanced'),playPage=advanced?.querySelector('.mav-arp-advanced__page--play');
  rememberExpanded(playMonitor,inlinePlay);
  const playNotice=document.createElement('span');playNotice.className='experiment-perf-play-notice';playNotice.textContent='PLAY controls are open in the ARP menu';
  const closeSub=()=>{if(!subPanel.hidden)subPanel.dispatchEvent(new CustomEvent('plicata-sub-detail-close'))};
  let enabled=null,expanded=false,currentLayout='',destroyed=false;
  // One set of controls and listeners: the open PLAY page temporarily borrows
  // its original monitor. Reserve the inline height so the keyboard stays still.
  const syncPlayHome=()=>{
    if(!playMonitor||!advanced||!playPage)return;
    const inMenu=expanded&&!advanced.hidden&&advanced.dataset.page==='PLAY';
    if(inMenu&&playMonitor.parentNode!==playPage){inlinePlay.style.minHeight=`${inlinePlay.offsetHeight}px`;inlinePlay.append(playNotice);playPage.append(playMonitor);}
    else if(!inMenu){playNotice.remove();inlinePlay.style.removeProperty('min-height');if(expanded&&playMonitor.parentNode!==inlinePlay)inlinePlay.append(playMonitor);}
  };
  const playObserver=new MutationObserver(syncPlayHome);if(advanced)playObserver.observe(advanced,{attributes:true,attributeFilter:['hidden','data-page']});
  const syncExpanded=()=>{const next=currentLayout==='fullscreen'&&shell.dataset.performanceMode==='1';if(next===expanded)return;expanded=next;shell.dataset.performanceDetails=next?'inline':'disclosure';deck.hidden=!next;keyTrigger.hidden=next||!enabled;subTrigger.closest('.mav-sub-more')?.classList.toggle('experiment-inline-hidden',next);
    if(next){closeKey();closeSub();for(const item of expandedEntries)item.destination.append(item.node);}
    else{for(const item of expandedEntries)item.marker.parentNode?.insertBefore(item.node,item.marker.nextSibling);if(enabled)for(const item of entries)item.destination.append(item.node);}
    syncPlayHome();
  };
  const modeObserver=new MutationObserver(syncExpanded);modeObserver.observe(shell,{attributes:true,attributeFilter:['data-performance-mode']});
  const closeKey=()=>{keyPanel.hidden=true;keyTrigger.setAttribute('aria-expanded','false')};
  const place=(panel,trigger)=>{
    if(panel.hidden||!enabled)return;
    const bounds=trigger.getBoundingClientRect(),width=Math.min(panel===keyPanel?360:300,innerWidth-24);
    panel.style.width=`${width}px`;panel.style.maxHeight=`${Math.min(420,innerHeight-24)}px`;
    const height=panel.getBoundingClientRect().height,left=Math.max(12,Math.min(innerWidth-width-12,bounds.right-width)),below=bounds.bottom+8;
    panel.style.left=`${left}px`;panel.style.top=`${Math.max(12,Math.min(innerHeight-height-12,below+height<=innerHeight-12?below:bounds.top-height-8))}px`;
  };
  const head=(panel,title,close)=>{const header=document.createElement('header');header.className='experiment-detail-head';const label=document.createElement('strong');label.textContent=title;const button=document.createElement('button');button.type='button';button.textContent='×';button.setAttribute('aria-label',`Close ${title.toLowerCase()}`);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();close()});header.append(label,button);panel.prepend(header);return header};
  const keyHead=head(keyPanel,'KEYBOARD DETAIL',closeKey),subHead=head(subPanel,'SUB DETAIL',closeSub);
  const toggleKey=()=>{if(!enabled)return;const opening=keyPanel.hidden;if(opening){closeSub();if(arpTrigger.getAttribute('aria-expanded')==='true')arpTrigger.click()}keyPanel.hidden=!opening;keyTrigger.setAttribute('aria-expanded',String(opening));if(opening)place(keyPanel,keyTrigger)};
  keyTrigger.addEventListener('click',toggleKey);
  const observeSub=new MutationObserver(()=>{if(enabled&&!subPanel.hidden){closeKey();place(subPanel,subTrigger)}});observeSub.observe(subPanel,{attributes:true,attributeFilter:['hidden']});
  const onLifecycle=event=>{if(String(event.detail||'')!=='paused')return;for(const panel of [keyPanel,subPanel])for(const control of panel.querySelectorAll('[data-continuous-control-gesture]'))control.dispatchEvent(new CustomEvent('ppw-control-cancel',{detail:{outcome:'cancel'}}));closeKey();closeSub()};
  addEventListener('ppw-host-lifecycle',onLifecycle);
  const onArp=()=>closeKey(),onEscape=event=>{if(event.key==='Escape'&&!keyPanel.hidden){closeKey();keyTrigger.focus()}};
  addEventListener('plicata-arp-detail-open',onArp);keyPanel.addEventListener('keydown',onEscape);
  const onResize=()=>{place(keyPanel,keyTrigger);place(subPanel,subTrigger)};addEventListener('resize',onResize,{passive:true});
  return {
    setLayout(layout){
      currentLayout=layout;const next=layout!=='legacy';if(enabled===next){syncExpanded();return;}if(expanded){currentLayout='legacy';syncExpanded();currentLayout=layout;}enabled=next;
      shell.dataset.keyboardDisclosure=next?'1':'0';keyTrigger.hidden=!next;keyHead.hidden=!next;subHead.hidden=!next;
      closeKey();closeSub();
      if(next){for(const item of entries)item.destination.append(item.node);document.body.append(subPanel);subPanel.classList.add('experiment-detail-panel');}
      else{for(const item of entries)item.marker.parentNode?.insertBefore(item.node,item.marker.nextSibling);meta.append(globals);subAnchor.parentNode?.insertBefore(subPanel,subAnchor.nextSibling);subPanel.classList.remove('experiment-detail-panel');for(const property of ['left','top','width','max-height'])subPanel.style.removeProperty(property);}
      syncExpanded();
    },
    destroy(){if(destroyed)return;this.setLayout('legacy');destroyed=true;modeObserver.disconnect();playObserver.disconnect();observeSub.disconnect();removeEventListener('resize',onResize);removeEventListener('plicata-arp-detail-open',onArp);removeEventListener('ppw-host-lifecycle',onLifecycle);keyPanel.removeEventListener('keydown',onEscape);keyTrigger.removeEventListener('click',toggleKey);keyTrigger.remove();keyPanel.remove();subHead.remove();subAnchor.remove();deck.remove();for(const item of expandedEntries)item.marker.remove();for(const item of entries)item.marker.remove();}
  };
}
