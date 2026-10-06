(() => {
  'use strict';

  const VERSION = 1;
  const implementations = new Map();
  const instances = new Set();
  const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
  const SHA = /^[a-f0-9]{64}$/;
  const VALID_KINDS = new Set(['generic', 'custom_dom', 'custom_webgl2']);
  const VIEW_MODES = new Set(['compact', 'regular', 'expanded']);
  const MAX_ENDPOINT_IDS = 2048;
  const DEFAULT_ARRAY_ITEMS = 64;
  const COMPLETE_STATE_PACKET_ITEMS = 256;

  function fail(code, detail = '') {
    throw new Error(detail ? `${code}:${detail}` : code);
  }

  function freeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
    Object.freeze(value);
    for (const item of Array.isArray(value) ? value : Object.values(value)) freeze(item);
    return value;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function bounded(value, depth = 0, binaryBudget = null, maxDepth = 4, completeStateMaps = false, field = '') {
    if (depth > maxDepth) return null;
    if (value === null || value === undefined) return value ?? null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      // Structured host-state bridges transport JSON as a string. Treat that one
      // declared state-bearing field as payload, not presentation text; otherwise
      // MAP/SIG and other rich musical state is silently truncated at 256 chars
      // before it ever reaches the native AU state store.
      if (completeStateMaps && field === 'json') return value.slice(0, 1024 * 1024);
      return value.slice(0, 256);
    }
    if (binaryBudget && value instanceof ArrayBuffer) {
      if (value.byteLength > binaryBudget.remaining) return null;
      binaryBudget.remaining -= value.byteLength;
      return value.slice(0);
    }
    if (binaryBudget && ArrayBuffer.isView(value)) {
      if (value.byteLength > binaryBudget.remaining) return null;
      binaryBudget.remaining -= value.byteLength;
      return typeof value.slice === 'function' ? value.slice() : new value.constructor(value);
    }
    if (Array.isArray(value)) {
      // Ordinary UI payloads remain capped at 64 items. Complete state-bearing
      // host actions may carry fixed serialized DSP/state packets as numeric
      // arrays (for example MUTAVIA seqA/seqB are 84 bytes). Preserve those
      // named packet fields without widening arbitrary arrays globally.
      const arrayLimit = completeStateMaps && (field === 'seqA' || field === 'seqB') ? COMPLETE_STATE_PACKET_ITEMS : DEFAULT_ARRAY_ITEMS;
      return value.slice(0, arrayLimit).map(item => bounded(item, depth + 1, binaryBudget, maxDepth, completeStateMaps, field));
    }
    if (typeof value === 'object') {
      const result = {};
      // Complete product responses may contain more than 64 declared controls.
      // Widen only the two numeric state maps, not arbitrary objects or arrays.
      const keyLimit = completeStateMaps && (field === 'controls' || field === 'parameters') ? MAX_ENDPOINT_IDS : 64;
      for (const [key, item] of Object.entries(value).slice(0, keyLimit))
        result[String(key).slice(0, 96)] = bounded(item, depth + 1, binaryBudget, maxDepth, completeStateMaps, key);
      return result;
    }
    return null;
  }

  function validateDescriptor(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('surfaceRuntime.invalidDescriptor');
    const allowed = new Set(['kind', 'endpointIds', 'maxElements', 'descriptorDigest']);
    if (Object.keys(input).some(key => !allowed.has(key))) fail('surfaceRuntime.unknownDescriptorField');
    if (!VALID_KINDS.has(input.kind)) fail('surfaceRuntime.invalidKind');
    if (!Array.isArray(input.endpointIds) || input.endpointIds.length > MAX_ENDPOINT_IDS)
      fail('surfaceRuntime.invalidEndpoints');
    const endpointIds = [];
    const seen = new Set();
    for (const raw of input.endpointIds) {
      if (typeof raw !== 'string' || raw.length > 255 || !raw.includes('.') || seen.has(raw))
        fail('surfaceRuntime.invalidEndpoint', String(raw));
      seen.add(raw); endpointIds.push(raw);
    }
    const maxElements = Number(input.maxElements);
    if (!Number.isSafeInteger(maxElements) || maxElements < 1 || maxElements > 4096)
      fail('surfaceRuntime.invalidElementBudget');
    if (input.descriptorDigest !== undefined &&
        (typeof input.descriptorDigest !== 'string' || !SHA.test(input.descriptorDigest)))
      fail('surfaceRuntime.invalidDescriptorDigest');
    return freeze({kind: input.kind, endpointIds, maxElements,
      ...(input.descriptorDigest ? {descriptorDigest: input.descriptorDigest} : {})});
  }

  function validateViewport(input = {}) {
    const mode = String(input.mode || 'compact');
    if (!VIEW_MODES.has(mode)) fail('surfaceRuntime.invalidViewportMode');
    const width = Number(input.width || 0), height = Number(input.height || 0);
    const pixelRatio = Number(input.pixelRatio || 1);
    if (!Number.isFinite(width) || width < 0 || width > 16384 ||
        !Number.isFinite(height) || height < 0 || height > 16384 ||
        !Number.isFinite(pixelRatio) || pixelRatio <= 0 || pixelRatio > 8)
      fail('surfaceRuntime.invalidViewport');
    const pointer = input.pointerCapabilities || {};
    const safe = input.safeInsets || {};
    const safeInsets = {};
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      const value = Number(safe[edge] || 0);
      if (!Number.isFinite(value) || value < 0 || value > 2048) fail('surfaceRuntime.invalidSafeInsets');
      safeInsets[edge] = value;
    }
    return freeze({
      mode, width, height, pixelRatio,
      pointerCapabilities: {
        coarse: !!pointer.coarse,
        fine: pointer.fine !== false,
        hover: !!pointer.hover,
        multiTouch: pointer.multiTouch !== false,
      },
      reducedMotion: !!input.reducedMotion,
      safeInsets,
    });
  }

  function implementationKey(kind, implementationId) {
    return `${kind}:${implementationId || 'default'}`;
  }

  function registerImplementation(kind, implementationId, factory) {
    if (!VALID_KINDS.has(kind) || kind === 'generic') fail('surfaceRuntime.invalidRegistrationKind');
    if (typeof implementationId !== 'string' || !ID.test(implementationId))
      fail('surfaceRuntime.invalidImplementationId');
    if (typeof factory !== 'function') fail('surfaceRuntime.invalidFactory');
    const key = implementationKey(kind, implementationId);
    if (implementations.has(key)) fail('surfaceRuntime.duplicateImplementation', key);
    implementations.set(key, factory);
    return true;
  }

  function hasImplementation(kind, implementationId) {
    return implementations.has(implementationKey(kind, implementationId));
  }

  async function loadImplementation({kind, implementationId, url}) {
    if (!VALID_KINDS.has(kind) || kind === 'generic') fail('surfaceRuntime.invalidRegistrationKind');
    if (typeof implementationId !== 'string' || !ID.test(implementationId))
      fail('surfaceRuntime.invalidImplementationId');
    if (hasImplementation(kind, implementationId)) return true;
    if (typeof url !== 'string' || !url) fail('surfaceRuntime.invalidImplementationUrl');
    const resolved = new URL(url, globalThis.location?.href || 'http://localhost/');
    if (globalThis.location?.origin && resolved.origin !== globalThis.location.origin)
      fail('surfaceRuntime.crossOriginImplementationForbidden');
    await import(resolved.href);
    if (!hasImplementation(kind, implementationId))
      fail('surfaceRuntime.implementationDidNotRegister', implementationId);
    return true;
  }

  function legacyAdapter(options) {
    return {
      read: options.getEndpoint,
      write: options.setEndpoint,
      writeBatch: options.setEndpointBatch,
      trigger: options.trigger,
      midi: options.midi,
      transport: options.transport,
      telemetry: options.telemetry,
      resource: id => options.resources?.[id],
      writeResource: options.setResource,
      viewport: options.viewport,
      beginTransaction: options.beginTransaction,
      endTransaction: options.endTransaction,
      requestHostAction: options.requestHostAction,
      onSurfaceError: options.onSurfaceError,
    };
  }

  function mount(options) {
    if (!options || typeof options !== 'object') fail('surfaceRuntime.invalidMount');
    const root = options.root;
    if (!(root instanceof HTMLElement)) fail('surfaceRuntime.invalidRoot');
    const descriptor = validateDescriptor(options.descriptor);
    if (descriptor.kind === 'generic') {
      root.hidden = true;
      return freeze({kind: 'generic', status: 'generic', destroy() {}, refresh() {}, serialize() { return null; },
        restore() {}, reset() {}, resize() {}, debugState() { return {kind: 'generic', status: 'generic'}; }});
    }
    const implementationId = String(options.implementationId || 'default');
    if (!ID.test(implementationId)) fail('surfaceRuntime.invalidImplementationId');
    const factory = implementations.get(implementationKey(descriptor.kind, implementationId));
    if (!factory) fail('surfaceRuntime.implementationUnavailable', implementationId);

    const adapter = options.adapter && typeof options.adapter === 'object' ? options.adapter : legacyAdapter(options);
    const allowed = new Set(descriptor.endpointIds);
    const metadata = freeze(clone(options.metadata || {}));
    const config = freeze(clone(options.config || {}));
    let currentViewport = validateViewport(adapter.viewport?.() || options.viewport || {});
    let destroyed = false;
    let fault = '';
    let surface = null;
    let observer = null;
    let contextLossHandler = null;
    const transactions = new Set();
    const telemetrySubscriptions = new Set();
    let cachedTelemetry = null, cachedTelemetryRevision;
    const readTelemetry = () => {
      // Opt-in revision contract: legacy adapters may mutate telemetry in place,
      // so they must retain uncached reads. Revision-aware hosts advance on every
      // replacement, allowing all consumers to share one bounded immutable copy.
      const revision = adapter.telemetryRevision?.();
      const cacheable = Number.isSafeInteger(revision);
      if (cacheable && cachedTelemetry && revision === cachedTelemetryRevision) return cachedTelemetry;
      const value = freeze(bounded(adapter.telemetry?.() || {}, 0, {remaining:64 * 1024 * 1024}, 8));
      if (cacheable) { cachedTelemetry = value; cachedTelemetryRevision = revision; }
      return value;
    };
    const clearTelemetrySubscriptions = () => {
      for (const unsubscribe of [...telemetrySubscriptions]) unsubscribe();
    };

    const assertEndpoint = id => {
      if (typeof id !== 'string' || !allowed.has(id)) fail('surfaceRuntime.endpointDenied', String(id));
    };
    const reportFault = error => {
      if (fault) return;
      fault = String(error?.message || error || 'surfaceRuntime.unknownFault').slice(0, 500);
      try { surface?.destroy?.(); } catch {}
      surface = null;
      clearTelemetrySubscriptions();
      observer?.disconnect(); observer = null;
      if (contextLossHandler) root.removeEventListener('webglcontextlost', contextLossHandler, true);
      contextLossHandler = null;
      root.replaceChildren(); root.hidden = true;
      try { adapter.onSurfaceError?.(fault); } catch {}
    };
    const guarded = (operation, fallback = undefined) => {
      if (destroyed || fault) return fallback;
      try { return operation(); }
      catch (error) { reportFault(error); return fallback; }
    };
    const api = freeze({
      version: VERSION,
      metadata,
      config,
      descriptor,
      read(id) {
        assertEndpoint(id);
        const value = adapter.read?.(id);
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'boolean' || typeof value === 'string') return value;
        return null;
      },
      getEndpoint(id) { return this.read(id); },
      write(id, value, transaction = null) {
        assertEndpoint(id);
        if (destroyed || fault) fail('surfaceRuntime.destroyed');
        if (typeof value === 'number' && !Number.isFinite(value)) fail('surfaceRuntime.invalidEndpointValue', id);
        if (transaction !== null && !transactions.has(String(transaction)))
          fail('surfaceRuntime.unknownTransaction');
        if (adapter.write?.(id, value, transaction) !== true) fail('surfaceRuntime.endpointRejected', id);
        return true;
      },
      setEndpoint(id, value) { return this.write(id, value, null); },
      async writeBatch(rows) {
        if (destroyed || fault) fail('surfaceRuntime.destroyed');
        if (!Array.isArray(rows) || rows.length < 1 || rows.length > 512) fail('surfaceRuntime.batchInvalid');
        const prepared = rows.map(row => {
          const id = String(row?.id || ''); assertEndpoint(id);
          const value = Number(row?.value); if (!Number.isFinite(value)) fail('surfaceRuntime.invalidEndpointValue', id);
          return {id, value};
        });
        if (typeof adapter.writeBatch === 'function') {
          if (await adapter.writeBatch(prepared) !== true) fail('surfaceRuntime.batchRejected');
          return true;
        }
        for (const row of prepared) this.write(row.id, row.value, null);
        return true;
      },
      beginTransaction(meta = {}) {
        const hostId = adapter.beginTransaction?.(bounded(meta));
        const id = String(hostId || `surface-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
        if (!id || transactions.has(id)) fail('surfaceRuntime.transactionInvalid');
        transactions.add(id); return id;
      },
      endTransaction(id, outcome = 'commit') {
        const key = String(id || '');
        if (!transactions.delete(key)) fail('surfaceRuntime.unknownTransaction');
        adapter.endTransaction?.(key, outcome === 'cancel' ? 'cancel' : 'commit');
        return true;
      },
      trigger(commandId, payload = null) {
        if (destroyed || fault) fail('surfaceRuntime.destroyed');
        if (typeof commandId !== 'string' || !commandId || commandId.length > 128)
          fail('surfaceRuntime.invalidCommand');
        if (adapter.trigger?.(commandId, bounded(payload)) !== true)
          fail('surfaceRuntime.commandRejected', commandId);
        return true;
      },
      async midi(endpointId, bytes, sampleOffset = 0) {
        assertEndpoint(endpointId);
        if (destroyed || fault) fail('surfaceRuntime.destroyed');
        if (!Array.isArray(bytes) && !(bytes instanceof Uint8Array)) fail('surfaceRuntime.invalidMidiBytes');
        const payload = Array.from(bytes);
        if (payload.length < 1 || payload.length > 3 || payload.some(value => !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 255))
          fail('surfaceRuntime.invalidMidiBytes');
        const offset = Number(sampleOffset);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 65535) fail('surfaceRuntime.invalidMidiOffset');
        if (await adapter.midi?.(endpointId, payload, offset) !== true) fail('surfaceRuntime.midiRejected', endpointId);
        return true;
      },
      transport() { return freeze(bounded(adapter.transport?.() || {})); },
      activeGestureValues() { return freeze(bounded(adapter.activeGestureValues?.() || {}, 0, {remaining:64 * 1024}, 2, false)); },
      telemetry: readTelemetry,
      subscribeTelemetry(callback) {
        if (typeof callback !== 'function') fail('surfaceRuntime.telemetryCallbackInvalid');
        if (destroyed || fault || typeof adapter.subscribeTelemetry !== 'function') return null;
        let active = true;
        const stop = adapter.subscribeTelemetry(() => {
          if (active && !destroyed && !fault) guarded(() => callback());
        });
        if (typeof stop !== 'function') return null;
        const unsubscribe = () => { if (!active) return; active = false; telemetrySubscriptions.delete(unsubscribe); stop(); };
        telemetrySubscriptions.add(unsubscribe);
        return unsubscribe;
      },
      resource(id) {
        if (typeof id !== 'string' || !id) fail('surfaceRuntime.resourceDenied', String(id));
        const value = adapter.resource?.(id);
        if (value === undefined) fail('surfaceRuntime.resourceDenied', id);
        return freeze(clone(value));
      },
      async writeResource(id, payload) {
        if (destroyed || fault) fail('surfaceRuntime.destroyed');
        if (typeof id !== 'string' || !id) fail('surfaceRuntime.resourceDenied', String(id));
        if (typeof adapter.writeResource !== 'function') fail('surfaceRuntime.resourceReadOnly', id);
        const result = await adapter.writeResource(id, bounded(payload, 0, {remaining:64 * 1024 * 1024}));
        if (result !== true && result?.accepted !== true) fail('surfaceRuntime.resourceRejected', id);
        return result === true ? true : freeze(bounded(result));
      },
      requestHostAction(id, payload = null) {
        if (typeof id !== 'string' || !id || id.length > 128) fail('surfaceRuntime.invalidHostAction');
        const stateBearing = id === 'product.action' || id.startsWith('product.patch.') || id.startsWith('product.sequence.') || id === 'patch.edit' || id === 'product.generate' || id.startsWith('preset.') || id.startsWith('tempora.project.') || id.startsWith('state.') || id.startsWith('midi.');
        const stateDepth = stateBearing ? 8 : 4;
        const accept = value => {
          if (value === true) return true;
          if (value && typeof value === 'object' && value.accepted !== false) {
            // Product-state responses legitimately contain nested patch cables, preset state,
            // and a small set of fixed serialized state-packet arrays. Keep the default host-action
            // depth tight; only named state-packet arrays receive the bounded 256-item allowance.
            // Ordinary arrays remain 64 items, ordinary objects 64 keys, and binary payloads 64 MiB.
            // GEN follows the same complete-state law as preset/patch recall:
            // truncating its cable rows to null erased the already-applied view.
            return freeze(bounded(value, 0, {remaining:64 * 1024 * 1024}, stateDepth, stateBearing));
          }
          fail('surfaceRuntime.hostActionRejected', id);
        };
        const result = adapter.requestHostAction?.(id, bounded(payload, 0, {remaining:64 * 1024 * 1024}, stateDepth, stateBearing));
        return result && typeof result.then === 'function' ? Promise.resolve(result).then(accept) : accept(result);
      },
      viewport() { return currentViewport; },
    });

    root.hidden = false;
    root.replaceChildren();
    try {
      surface = factory({root, api});
      if (!surface || typeof surface !== 'object') fail('surfaceRuntime.factoryRejected');
    } catch (error) {
      reportFault(error);
    }

    const countElements = () => 1 + root.querySelectorAll('*').length;
    const enforceBudget = () => {
      if (destroyed || fault) return;
      const count = countElements();
      if (count > descriptor.maxElements) reportFault(`surfaceRuntime.elementBudgetExceeded:${count}>${descriptor.maxElements}`);
    };
    enforceBudget();
    if (!destroyed && !fault && descriptor.kind === 'custom_webgl2') {
      contextLossHandler = event => {
        try { event.preventDefault?.(); } catch {}
        reportFault('surfaceRuntime.webglContextLost');
      };
      root.addEventListener('webglcontextlost', contextLossHandler, true);
    }
    if (!destroyed && !fault && typeof MutationObserver === 'function') {
      // textContent replaces Text nodes on every changing value/LED label. Those
      // mutations cannot affect the element budget; do not scan the whole panel.
      observer = new MutationObserver(records => {
        if (records.some(record => [...record.addedNodes, ...record.removedNodes]
          .some(node => node.nodeType === 1))) enforceBudget();
      });
      observer.observe(root, {childList: true, subtree: true});
    }

    const instance = {
      kind: descriptor.kind,
      implementationId,
      descriptor,
      get status() { return destroyed ? 'destroyed' : fault ? 'faulted' : 'mounted'; },
      // Optional change hints are advisory; surfaces that do not support them
      // keep their existing full refresh behavior.
      refresh(snapshot, changes = null) { return guarded(() => surface?.refresh?.(clone(snapshot), clone(changes))); },
      serialize() { return guarded(() => clone(surface?.serialize?.() ?? null), null); },
      reviewContext() { return guarded(() => clone(surface?.reviewContext?.() ?? null), null); },
      restore(value) { if (destroyed || fault) return false; return surface?.restore?.(clone(value)); },
      reset() { return guarded(() => surface?.reset?.()); },
      resize(viewport) {
        return guarded(() => {
          currentViewport = validateViewport(viewport);
          surface?.resize?.(currentViewport);
          return currentViewport;
        }, currentViewport);
      },
      debugState() {
        return freeze({destroyed, fault, status: this.status, elementCount: countElements(),
          implementationId, descriptor, viewport: currentViewport,
          transactionCount: transactions.size, surface: bounded(surface?.debugState?.() || {})});
      },
      destroy() {
        if (destroyed) return;
        destroyed = true; transactions.clear(); observer?.disconnect(); observer = null;
        clearTelemetrySubscriptions();
        if (contextLossHandler) root.removeEventListener('webglcontextlost', contextLossHandler, true);
        contextLossHandler = null;
        try { surface?.destroy?.(); } catch {}
        surface = null; root.replaceChildren(); root.hidden = true; instances.delete(instance);
      },
    };
    instances.add(instance);
    return instance;
  }

  const runtime = freeze({
    version: VERSION,
    registerImplementation,
    hasImplementation,
    loadImplementation,
    validateDescriptor,
    validateViewport,
    mount,
    activeCount: () => instances.size,
  });
  globalThis.TrambustissimoSurfaceRuntime = runtime;
  // Migration alias: existing Lab surfaces can become package-delivered without
  // learning a Rack-specific branch. New interfaces should use the neutral name.
  if (!globalThis.ModuleLabSurfaceHost) globalThis.ModuleLabSurfaceHost = runtime;
})();

// Hot compatibility bridge for stale persistent Rack page generators. The
// ordinary server-side package boot wins whenever it is present; this path only
// mounts a registry-published package into the existing Rack page when Python
// page generation predates that package publication.
(() => {
  'use strict';
  const HINTS = Object.freeze({
    'samplr-samp7-five-fx-v0': Object.freeze({
      packageId: 'gesture-sampler-interface-v1',
      packageDigest: '868b437b2099fa428031d5638a2e4cf2898fd2e98c675a3b4371d6119979f1a7',
    }),
  });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const camel = value => String(value || '').replace(/-([a-z0-9])/g, (_m, c) => c.toUpperCase());
  const productId = () => {
    const parts = String(location.pathname || '').split('/').filter(Boolean);
    return parts[0] === 'composite' ? decodeURIComponent(parts[1] || '') : '';
  };
  const nativeEndpoint = endpoint => {
    const id = String(endpoint || '');
    if (id.startsWith('subject.')) return id.slice(8);
    if (id.startsWith('event.')) return id.slice(6);
    if (id.startsWith('telemetry.')) return camel(id.slice(10));
    return '';
  };
  const viewport = root => {
    const rect = root.getBoundingClientRect(), width = Math.max(320, Math.round(rect.width || innerWidth || 390)),
      height = Math.max(420, Math.round(rect.height || innerHeight || 840)),
      coarse = globalThis.matchMedia?.('(pointer: coarse)')?.matches === true;
    return {mode: width <= 600 ? 'compact' : width <= 1100 ? 'regular' : 'expanded', width, height,
      pixelRatio: Number(devicePixelRatio || 1), pointerCapabilities: {coarse, fine: !coarse, hover: !coarse, multiTouch: coarse},
      reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
      safeInsets: {top:0,right:0,bottom:0,left:0}};
  };
  async function mountHotPackage(retryNonce = '') {
    const id = productId(), hint = HINTS[id];
    if (!hint) return false;
    const sideKey = `moduleLabHotPackageSurfaceV1:${id}:${hint.packageId}`;
    try {
      if (!localStorage.getItem(sideKey)) {
        const hostKey = globalThis.__auditionStateDebug?.storageKey?.('current');
        const envelope = hostKey ? JSON.parse(localStorage.getItem(hostKey) || 'null') : null;
        const legacy = envelope?.custom?.surface;
        if (legacy?.schema === 'gesture-sampler-surface-state-v2') {
          localStorage.setItem(sideKey, JSON.stringify({schema:'module-lab-hot-package-surface-v1',packageId:hint.packageId,
            packageDigest:hint.packageDigest,state:legacy,at:Date.now(),migratedFrom:'audition-state-v1.custom.surface'}));
          globalThis.__auditionHotPackageLegacyMigration = {ok:true,hostKey,sideKey,at:performance.now()};
        }
      }
    } catch (error) {
      globalThis.__auditionHotPackageLegacyMigration = {ok:false,error:String(error?.message || error),sideKey,at:performance.now()};
    }
    for (let i = 0; i < (retryNonce ? 1 : 80); ++i) {
      const ordinary = globalThis.__auditionModuleProductPackageSurface;
      if (ordinary || document.querySelector('#customSurfacePanel .gsRack')) {
        if (ordinary?.hotFallback !== true && typeof ordinary?.restore === 'function') {
          try {
            const row = JSON.parse(localStorage.getItem(sideKey) || 'null');
            if (row?.packageId === hint.packageId && row?.state) {
              const accepted = ordinary.restore(row.state) !== false;
              if (accepted) {
                const migratedAt = performance.now();
                globalThis.__auditionScheduleStateSave?.();
                setTimeout(() => {
                  if (globalThis.__auditionStateAutosave?.ok === true && Number(globalThis.__auditionStateAutosave?.at || 0) >= migratedAt)
                    localStorage.removeItem(sideKey);
                }, 900);
                globalThis.__auditionHotPackageMigration = {ok:true,sideKey,at:migratedAt};
              }
            }
          } catch (error) {
            globalThis.__auditionHotPackageMigration = {ok:false,error:String(error?.message || error),sideKey,at:performance.now()};
          }
        }
        return true;
      }
      await sleep(25);
    }
    const root = document.getElementById('customSurfacePanel'), runtime = globalThis.TrambustissimoSurfaceRuntime,
      zero = globalThis.ModuleLabZeroRuntime, zeroHost = globalThis.__auditionZeroHost;
    if (!root || !runtime?.loadImplementation || !runtime?.mount || !zero) return false;
    const hotControlOverrides = globalThis.__auditionHotPackageControlOverrides instanceof Map
      ? globalThis.__auditionHotPackageControlOverrides : new Map();
    globalThis.__auditionHotPackageControlOverrides = hotControlOverrides;
    if (zeroHost && typeof zeroHost.controlValues === 'function' && !zeroHost.__hotPackageControlOverlay) {
      const originalControlValues = zeroHost.controlValues.bind(zeroHost);
      zeroHost.controlValues = () => ({...originalControlValues(), ...Object.fromEntries(globalThis.__auditionHotPackageControlOverrides || [])});
      zeroHost.__hotPackageControlOverlay = true;
    }
    const base = `/module-package/${encodeURIComponent(hint.packageId)}/${hint.packageDigest}`;
    const response = await fetch(`${base}/manifest.json`, {cache:'no-store'});
    if (!response.ok) throw new Error(`hotPackage.manifestHttp:${response.status}`);
    const manifest = await response.json();
    if (manifest?.schema !== 'trambustissimo-module-product-package-v1' || manifest.packageId !== hint.packageId ||
        manifest.packageDigest !== hint.packageDigest || manifest.productId !== id ||
        String(manifest.runtime?.id || '') !== id || String(manifest.runtime?.kind || '') !== 'modular_product')
      throw new Error('hotPackage.identityMismatch');
    const runtimeKey = String(zero.snapshotForTest?.()?.productKey || zero.snapshotForTest?.()?.runtimeConfig?.productKey || '');
    if (runtimeKey && String(manifest.runtime?.digest || '') !== runtimeKey) throw new Error('hotPackage.runtimeDigestMismatch');
    const presentation = manifest.presentation || {}, interfaceId = String(presentation.preferredInterfaceId || ''),
      iface = (presentation.interfaces || []).find(row => String(row?.id || '') === interfaceId);
    if (!iface || !['host_compatible','product_admitted'].includes(String(iface.compatibility || ''))) throw new Error('hotPackage.interfaceUnavailable');
    const assets = new Map((manifest.assets || []).map(row => [String(row?.id || ''), row]));
    const entry = assets.get(String(iface.entryAssetId || '')), configAsset = iface.configAssetId ? assets.get(String(iface.configAssetId)) : null;
    if (!entry) throw new Error('hotPackage.entryUnavailable');
    const config = configAsset ? await fetch(`${base}/assets/${String(configAsset.path).split('/').map(encodeURIComponent).join('/')}`, {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error(`hotPackage.configHttp:${r.status}`); return r.json();
    }) : {};
    const table = new Map((manifest.bindings || []).map(row => [String(row?.id || ''), row]));
    const ordinary = (iface.bindingIds || []).map(key => table.get(String(key))).filter(Boolean),
      telemetryRows = (iface.telemetryBindingIds || []).map(key => table.get(String(key))).filter(Boolean),
      endpointIds = ordinary.filter(row => ['candidate_parameter','product_control','authored_state','host_companion_control'].includes(String(row.kind || '')))
        .map(row => String(row.endpointId || '')).filter(Boolean);
    const renderer = String(iface.renderer || ''), kind = renderer === 'webgl2' ? 'custom_webgl2' : renderer === 'dom' ? 'custom_dom' : '';
    if (!kind) throw new Error('hotPackage.rendererUnsupported');
    const entryUrl=`${base}/assets/${String(entry.path).split('/').map(encodeURIComponent).join('/')}${retryNonce?`?hotRetry=${encodeURIComponent(retryNonce)}`:''}`;
    await runtime.loadImplementation({kind, implementationId:String(iface.implementationId || ''),url:entryUrl});
    const adapter = {
      read(endpoint) {
        const native = nativeEndpoint(endpoint), snap = zero.snapshotForTest?.() || {}, values = snap.runtime?.exposedControlValues || {};
        const runtimeValue = Number(values[native]);
        if (Number.isFinite(runtimeValue)) return runtimeValue;
        if (hotControlOverrides.has(native)) return Number(hotControlOverrides.get(native));
        const hostValue = Number(zeroHost?.controlValues?.()?.[native]);
        return Number.isFinite(hostValue) ? hostValue : null;
      },
      write(endpoint, value) {
        const native = nativeEndpoint(endpoint), number = Number(value); if (!native || !Number.isFinite(number)) return false;
        hotControlOverrides.set(native, number);
        const accepted = zero.setControlInput?.(native, number) === true;
        const effective = accepted || zero.isActive?.() !== true;
        if (effective) { globalThis.__auditionScheduleStateSave?.(); globalThis.__auditionHotPackagePersistSoon?.(); }
        return effective;
      },
      async writeBatch(rows) {
        let accepted = true;
        for (const row of rows || []) accepted = this.write(row.id, row.value) && accepted;
        return accepted;
      },
      trigger(endpoint, payload = null) {
        const native = nativeEndpoint(endpoint), value = Number.isFinite(Number(payload)) ? Number(payload) : 1;
        if (!native) return false;
        if (zero.isActive?.()) return zero.trigger?.(native, value) === true;
        void Promise.resolve(globalThis.startRuntimePlayback?.(false)).then(ok => { if (ok === true || zero.isActive?.()) zero.trigger?.(native, value); });
        return true;
      },
      telemetry() {
        const snap = zero.snapshotForTest?.() || {}, controls = snap.runtime?.controlValues || {}, values = {};
        for (const row of telemetryRows) {
          const endpoint = String(row.endpointId || ''), native = nativeEndpoint(endpoint), value = Number(controls[native]);
          values[endpoint] = Number.isFinite(value) ? value : 0;
        }
        return {values,mixPeak:Math.max(0,Number(snap.lastPeak||0))};
      },
      transport() {
        const snap = zero.snapshotForTest?.() || {};
        return {state:zero.isActive?.() ? 'playing' : 'stopped', beat:0,
          bpm:Number(snap.runtime?.exposedControlValues?.['tempo-bpm'] || 120), loop:true};
      },
      viewport: () => viewport(root),
      onSurfaceError(error) { globalThis.__auditionHotPackageFault = {error:String(error?.message || error), at:performance.now()}; },
    };
    const descriptor = {kind, endpointIds:[...new Set(endpointIds)].sort(), maxElements:Number(iface.budgets?.maxElements || 1),
      descriptorDigest:String(iface.interfaceDigest || '')};
    const anchor = document.querySelector('.rackContext') || document.querySelector('.rackTruth') || document.querySelector('.head');
    if (anchor && root.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', root);
    root.classList.add('rackPrimarySurface');
    const instance = runtime.mount({root, descriptor, implementationId:String(iface.implementationId || ''),
      metadata:{module:{productId:id},package:{packageId:hint.packageId,packageDigest:hint.packageDigest,interfaceId},role:String(iface.role || 'performance_surface')},
      config, adapter});
    instance.resize?.(viewport(root));
    globalThis.__auditionModuleProductPackageSurface = {
      schema:'module-product-package-rack-mounted-v1', hotFallback:true,
      package:{packageId:hint.packageId,packageDigest:hint.packageDigest,interfaceId,interfaceDigest:String(iface.interfaceDigest || '')},
      implementationId:String(iface.implementationId || ''), debugState:()=>instance.debugState?.() || null,
    };
    document.body.classList.add('rackHasPrimarySurface');
    const keepPrimaryVisible=()=>{if(root.hidden)root.hidden=false;for(const node of document.querySelectorAll('#rackStandardPresentation,#rackGenericPresentation'))if(!node.hidden)node.hidden=true};
    keepPrimaryVisible();
    const visibilityObserver=typeof MutationObserver==='function'?new MutationObserver(()=>keepPrimaryVisible()):null;
    visibilityObserver?.observe(root,{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('pagehide',()=>visibilityObserver?.disconnect(),{once:true});
    setTimeout(keepPrimaryVisible,120);setTimeout(keepPrimaryVisible,600);setTimeout(keepPrimaryVisible,1800);
    let persistenceTimer = 0;
    const persistSurface = async() => {
      try {
        const state = instance.serialize?.() ?? null;
        if (!state) return false;
        localStorage.setItem(sideKey, JSON.stringify({schema:'module-lab-hot-package-surface-v1',packageId:hint.packageId,
          packageDigest:hint.packageDigest,state,at:Date.now()}));
        globalThis.__auditionHotPackagePersistence = {ok:true,key:sideKey,at:performance.now()};
        return true;
      } catch (error) {
        globalThis.__auditionHotPackagePersistence = {ok:false,error:String(error?.message || error),key:sideKey,at:performance.now()};
        return false;
      }
    };
    const persistSoon = () => { clearTimeout(persistenceTimer); persistenceTimer = setTimeout(() => void persistSurface(), 520); };
    globalThis.__auditionHotPackagePersistSoon = persistSoon;
    try {
      const row = JSON.parse(localStorage.getItem(sideKey) || 'null');
      if (row?.packageId === hint.packageId && row?.state) instance.restore?.(row.state);
    } catch {}
    root.addEventListener('change', persistSoon, true);
    root.addEventListener('pointerup', persistSoon, true);
    root.addEventListener('drop', persistSoon, true);
    globalThis.__auditionHotPackageMount = {ok:true, productId:id, packageId:hint.packageId, packageDigest:hint.packageDigest, at:performance.now()};
    return true;
  }
  let mountAttempt=0;
  const run=()=>{const attempt=mountAttempt++;return mountHotPackage(attempt?`${attempt}-${Date.now()}`:'').catch(error=>{globalThis.__auditionHotPackageMount={ok:false,error:String(error?.message||error),attempt:attempt+1,at:performance.now()};if(attempt<2)setTimeout(()=>void run(),250*(attempt+1));return false})};
  if (document.readyState === 'complete') void run(); else window.addEventListener('load', () => void run(), {once:true});
})();

// Samplr's packaged performance surface is the primary view. The stale Rack
// process can restore the legacy generic presentation after the package mounts;
// promote package exactly once at startup, while leaving later manual switching
// to STANDARD/GENERIC fully under user control.
(() => {
  'use strict';
  const parts=String(location.pathname||'').split('/').filter(Boolean);
  if(parts[0]!=='composite'||decodeURIComponent(parts[1]||'')!=='samplr-samp7-five-fx-v0')return;
  const started=performance.now();
  const timer=setInterval(()=>{
    const surface=globalThis.__auditionModuleProductPackageSurface,state=globalThis.__auditionPresentationState,
      available=Array.isArray(state?.available)?state.available:[];
    if(surface&&available.includes('package')){
      if(state?.mode!=='package')globalThis.__auditionSetPresentation?.('package');
      clearInterval(timer);return;
    }
    if(performance.now()-started>7000)clearInterval(timer);
  },120);
})();
