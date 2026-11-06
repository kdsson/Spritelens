const $ = (q) => document.querySelector(q);
const els = { welcome: $('#welcome'), workspace: $('#workspace'), input: $('#file-input'), drop: $('#dropzone'), open: $('#open-file'), fullscreen: $('#fullscreen-toggle'), fullscreenLabel: $('#fullscreen-label'), browse: $('#browse'), example: $('#example'), change: $('#change-file'), download: $('#download-sprite'), toast: $('#toast'), name: $('#sprite-name'), info: $('#file-info'), costumeCount: $('#costume-count'), codeCount: $('#code-count'), grid: $('#costume-grid'), large: $('#large-costume'), selectedName: $('#selected-name'), selectedIndex: $('#selected-index'), empty: $('#preview-empty'), scripts: $('#scripts'), spriteList: $('#sprite-list'), soundCount: $('#sound-count'), soundList: $('#sound-list') };
let currentSprite = null;
let currentDocument = null;
let selectedTargetIndex = 0;
let currentUrls = [];
let toastTimer;
let generatedOutput = null;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 3600);
}
function chooseFile() { els.input.click(); }
els.open.addEventListener('click', chooseFile);
els.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { showToast('Fullscreen is unavailable in this browser.'); }
});
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  const label = active ? 'Exit fullscreen' : 'Fullscreen';
  els.fullscreenLabel.textContent = label;
  els.fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  els.fullscreen.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
});
els.browse.addEventListener('click', (e) => { e.stopPropagation(); chooseFile(); });
els.change.addEventListener('click', chooseFile);
els.drop.addEventListener('click', (e) => { if (e.target !== els.browse) chooseFile(); });
els.drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseFile(); } });
els.input.addEventListener('change', () => { const file = els.input.files?.[0]; if (file) handleFile(file); els.input.value = ''; });
els.download.addEventListener('click', () => { if (!generatedOutput) return; const link = document.createElement('a'); link.href = URL.createObjectURL(generatedOutput.blob); link.download = generatedOutput.name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1500); });
for (const event of ['dragenter', 'dragover']) els.drop.addEventListener(event, (e) => { e.preventDefault(); els.drop.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) els.drop.addEventListener(event, (e) => { e.preventDefault(); els.drop.classList.remove('dragging'); });
els.drop.addEventListener('drop', (e) => { const file = e.dataTransfer?.files?.[0]; if (file) handleFile(file); });
$('#example').addEventListener('click', async () => {
  try { els.example.textContent = 'Loading example…'; const response = await fetch('./Font.sprite3'); if (!response.ok) throw new Error('Example file could not be loaded.'); const blob = await response.blob(); await loadFile(new File([blob], 'Font.sprite3', { type: 'application/zip' })); }
  catch (error) { showToast(error.message || 'Could not load the example file.'); }
  finally { els.example.innerHTML = 'Open the Font example <span>↗</span>'; }
});

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
function setTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => { const active = tab.dataset.tab === name; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
  $('#looks-panel').classList.toggle('hidden', name !== 'looks');
  $('#sounds-panel').classList.toggle('hidden', name !== 'sounds');
  $('#code-panel').classList.toggle('hidden', name !== 'code');
}
async function handleFile(file) {
  if (/\.ttf$/i.test(file.name)) return createFontSprite(file);
  return loadFile(file);
}
async function createFontSprite(file) {
  if (typeof JSZip === 'undefined') { showToast('Could not load the ZIP reader. Check your connection and retry.'); return; }
  let loadedFace = null;
  document.body.classList.add('loading');
  generatedOutput = null; els.download.classList.add('hidden');
  try {
    if (!('FontFace' in window)) throw new Error('This browser does not support loading font files.');
    const response = await fetch('./Font.sprite3');
    if (!response.ok) throw new Error('Could not load the example Font sprite code.');
    const templateZip = await JSZip.loadAsync(await response.blob());
    const spriteEntry = templateZip.file('sprite.json');
    if (!spriteEntry) throw new Error('The example Font sprite is missing its code.');
    const sprite = JSON.parse(await spriteEntry.async('text'));
    const family = 'LocalSpriteFont' + Math.random().toString(36).slice(2, 9);
    loadedFace = new FontFace(family, await file.arrayBuffer());
    await loadedFace.load(); document.fonts.add(loadedFace);
    const outputZip = new JSZip();
    for (let i = 0; i < sprite.costumes.length; i++) {
      const costume = sprite.costumes[i];
      const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create font costume images.');
      const glyph = costume.name === 'More' ? '[tap]' : (costume.name === ' ' ? 'o' : costume.name);
      if (glyph) {
        ctx.clearRect(0, 0, 48, 48);
        ctx.fillStyle = costume.name === ' ' ? '#278cff' : '#ff0000'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = (costume.name === 'More' ? '10px ' : '28px ') + '"' + family + '"';
        ctx.fillText(glyph, 24, 34);
      }
      const png = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not render a font character.')), 'image/png'));
      const assetId = 'f' + i.toString(16).padStart(31, '0');
      costume.assetId = assetId; costume.md5ext = assetId + '.png'; costume.dataFormat = 'png'; costume.bitmapResolution = 1;
      costume.rotationCenterX = 24; costume.rotationCenterY = 24;
      outputZip.file(costume.md5ext, await png.arrayBuffer());
    }
    const baseName = file.name.replace(/\.ttf$/i, '').trim() || 'Font';
    sprite.name = baseName;
    sprite.currentCostume = Math.min(1, sprite.costumes.length - 1);
    outputZip.file('sprite.json', JSON.stringify(sprite));
    const blob = await outputZip.generateAsync({ type: 'blob', mimeType: 'application/x.scratch.sprite' });
    const outputName = baseName.replace(/[^a-z0-9_-]+/gi, '_') + '.sprite3';
    generatedOutput = { blob, name: outputName };
    await loadFile(new File([blob], outputName, { type: 'application/x.scratch.sprite' }), true);
    showToast('Font costumes and example Scratch code are ready.');
  } catch (error) {
    showToast(error?.message || 'Could not create a sprite from this font.');
  } finally {
    if (loadedFace) document.fonts.delete(loadedFace);
    document.body.classList.remove('loading');
  }
}
async function loadFile(file, preserveDownload = false) {
  if (!preserveDownload) { generatedOutput = null; els.download.classList.add('hidden'); }
  if (typeof JSZip === 'undefined') { showToast('Could not load the ZIP reader. Check your connection and retry.'); return; }
  document.body.classList.add('loading');
  try {
    const zip = await JSZip.loadAsync(file);
    const projectEntry = zip.file('project.json');
    let targets, isProject = false;
    if (projectEntry) {
      const project = JSON.parse(await projectEntry.async('text'));
      if (!Array.isArray(project.targets) || !project.targets.length) throw new Error('This Scratch project has no sprites to display.');
      targets = project.targets; isProject = true;
    } else {
      const spriteEntry = zip.file('sprite.json') || Object.values(zip.files).find((entry) => !entry.dir && entry.name.endsWith('/sprite.json'));
      if (!spriteEntry) throw new Error('This archive has no project.json or sprite.json. Choose a Scratch .sb3 or .sprite3 file.');
      const data = JSON.parse(await spriteEntry.async('text'));
      if (!data || !data.blocks || !data.costumes) throw new Error('This sprite file is incomplete or invalid.');
      targets = [data];
    }
    if (currentUrls.length) currentUrls.forEach(URL.revokeObjectURL);
    currentUrls = [];
    const assets = new Map();
    const entries = targets.flatMap((target) => [...(target.costumes || []), ...(target.sounds || [])]);
    await Promise.all(entries.map(async (asset) => {
      const path = asset.md5ext || (asset.assetId ? asset.assetId + '.' + asset.dataFormat : '');
      if (!path) return;
      const entry = zip.file(path) || Object.values(zip.files).find((f) => !f.dir && f.name.split('/').pop() === path.split('/').pop());
      if (entry) {
        const blob = await entry.async('blob');
        const url = URL.createObjectURL(new Blob([blob], { type: mimeFor(asset.dataFormat) }));
        currentUrls.push(url); assets.set(path, url);
      }
    }));
    currentDocument = { targets, file, assets, isProject };
    selectedTargetIndex = 0;
    renderSprite();
  } catch (error) {
    showToast(error?.message || 'Could not read this Scratch file.');
  } finally { document.body.classList.remove('loading'); }
}
function mimeFor(format) { return ({ svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' })[String(format || '').toLowerCase()] || 'application/octet-stream'; }
function targetName(target, index) { return target.isStage ? 'Stage' : (target.name || 'Sprite ' + (index + 1)); }
function assetPath(asset) { return asset.md5ext || (asset.assetId ? asset.assetId + '.' + asset.dataFormat : ''); }
function renderSprite() {
  if (!currentDocument) return;
  els.welcome.classList.add('hidden'); els.workspace.classList.remove('hidden');
  const { targets, file, isProject } = currentDocument;
  els.name.textContent = isProject ? file.name.replace(/\.sb3$/i, '') : (targets[0].name || file.name.replace(/\.sprite3$/i, '') || 'Sprite');
  els.download.classList.toggle('hidden', !generatedOutput);
  if (generatedOutput) els.download.textContent = 'Download ' + generatedOutput.name + ' ↓';
  els.spriteList.classList.toggle('hidden', !isProject);
  if (isProject) renderSpriteList();
  selectTarget(Math.min(selectedTargetIndex, targets.length - 1));
}
function renderSpriteList() {
  els.spriteList.replaceChildren();
  currentDocument.targets.forEach((target, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'sprite-choice' + (index === selectedTargetIndex ? ' selected' : '');
    button.setAttribute('aria-pressed', String(index === selectedTargetIndex));
    const costume = target.costumes?.[0]; const url = costume ? currentDocument.assets.get(assetPath(costume)) : null;
    if (url) { const img = document.createElement('img'); img.src = url; img.alt = ''; button.append(img); }
    else { const mark = document.createElement('span'); mark.className = 'sprite-mark'; mark.textContent = target.isStage ? '▦' : (target.name || 'S').slice(0, 1).toUpperCase(); button.append(mark); }
    const label = document.createElement('span'); label.textContent = targetName(target, index); button.append(label);
    button.addEventListener('click', () => selectTarget(index)); els.spriteList.append(button);
  });
}
function selectTarget(index, resetTab = true) {
  if (!currentDocument) return;
  selectedTargetIndex = index;
  const data = currentDocument.targets[index];
  currentSprite = { data, file: currentDocument.file, assets: currentDocument.assets };
  if (currentDocument.isProject) renderSpriteList();
  els.info.textContent = currentDocument.isProject
    ? targetName(data, index) + ' · ' + (index + 1) + ' of ' + currentDocument.targets.length + ' · ' + formatBytes(currentDocument.file.size)
    : currentDocument.file.name + ' · ' + formatBytes(currentDocument.file.size);
  const sourceLabel = document.querySelector('.code-source');
  if (sourceLabel) sourceLabel.textContent = currentDocument.isProject ? 'project.json' : 'sprite.json';
  const costumes = data.costumes || [];
  els.costumeCount.textContent = costumes.length;
  const sounds = data.sounds || [];
  els.soundCount.textContent = sounds.length;
  const blocks = cleanBlocks(data.blocks || {});
  const scripts = Object.entries(blocks).filter(([, block]) => block.topLevel).sort((a, b) => (a[1].y || 0) - (b[1].y || 0) || (a[1].x || 0) - (b[1].x || 0));
  els.codeCount.textContent = scripts.length;
  renderCostumes(costumes);
  renderSounds(sounds);
  renderScripts(data, blocks, scripts);
  if (resetTab) setTab('looks');
}
function renderSounds(sounds) {
  els.soundList.replaceChildren();
  if (!sounds.length) { const empty = document.createElement('div'); empty.className = 'empty-code'; empty.textContent = 'No sounds in this sprite.'; els.soundList.append(empty); return; }
  sounds.forEach((sound) => {
    const row = document.createElement('div'); row.className = 'sound-row';
    const name = document.createElement('span'); name.className = 'sound-name'; name.textContent = sound.name || '(unnamed sound)'; row.append(name);
    const url = currentSprite.assets.get(assetPath(sound));
    if (url) { const player = document.createElement('audio'); player.controls = true; player.preload = 'none'; player.src = url; player.setAttribute('aria-label', 'Play ' + (sound.name || 'sound')); row.append(player); }
    els.soundList.append(row);
  });
}
function formatBytes(n) { if (!Number.isFinite(n)) return ''; return n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 1024 * 1024 ? 1 : 0) + (n < 1024 * 1024 ? ' KB' : ' KB'); }
function cleanBlocks(blocks) { const result = {}; for (const [id, block] of Object.entries(blocks || {})) if (block && !Array.isArray(block) && typeof block === 'object' && block.opcode) result[id] = block; return result; }
function renderCostumes(costumes) {
  els.grid.replaceChildren();
  if (!costumes.length) { els.grid.innerHTML = '<div class="empty-code">This sprite has no costumes.</div>'; selectCostume(null, -1); return; }
  costumes.forEach((costume, index) => {
    const path = costume.md5ext || (costume.assetId ? costume.assetId + '.' + costume.dataFormat : '');
    const url = currentSprite.assets.get(path);
    const card = document.createElement('button'); card.className = 'costume-card'; card.type = 'button'; card.setAttribute('aria-label', 'Costume ' + costume.name);
    const preview = document.createElement('span'); preview.className = 'costume-thumb';
    if (url) { const img = document.createElement('img'); img.src = url; img.alt = ''; preview.append(img); }
    const label = document.createElement('span'); label.className = 'costume-name'; label.textContent = costume.name || '(unnamed)';
    card.append(preview, label); card.addEventListener('click', () => selectCostume(index, index)); els.grid.append(card);
  });
  const initial = Math.max(0, Math.min(costumes.length - 1, Number(currentSprite.data.currentCostume) || 0)); selectCostume(initial, initial);
}
function selectCostume(index, cardIndex) {
  const cards = [...els.grid.children]; cards.forEach((card, i) => card.classList.toggle('selected', i === cardIndex));
  const costume = index == null ? null : currentSprite.data.costumes[index];
  if (!costume) { els.large.removeAttribute('src'); els.large.classList.add('hidden'); els.empty.classList.remove('hidden'); els.selectedName.textContent = 'No costume'; els.selectedIndex.textContent = ''; return; }
  const path = costume.md5ext || (costume.assetId ? costume.assetId + '.' + costume.dataFormat : '');
  const url = currentSprite.assets.get(path);
  els.selectedName.textContent = costume.name || '(unnamed)';
  els.selectedIndex.textContent = (index + 1) + ' / ' + currentSprite.data.costumes.length;
  if (url) { els.large.src = url; els.large.classList.remove('hidden'); els.empty.classList.add('hidden'); }
  else { els.large.removeAttribute('src'); els.large.classList.add('hidden'); els.empty.classList.remove('hidden'); }
}
const LABELS = {
  event_whenflagclicked:'when ⚑ clicked', event_whenkeypressed:'when key pressed', event_whenthisspriteclicked:'when this sprite clicked', event_whenstageclicked:'when stage clicked', event_whenbroadcastreceived:'when I receive', event_whenbackdropswitchesto:'when backdrop switches to', event_whengreaterthan:'when',
  motion_movesteps:'move {STEPS} steps', motion_turnright:'turn ↻ {DEGREES} degrees', motion_turnleft:'turn ↺ {DEGREES} degrees', motion_goto:'go to {TO}', motion_gotoxy:'go to x: {X} y: {Y}', motion_glidesecstoxy:'glide {SECS} secs to x: {X} y: {Y}', motion_pointindirection:'point in direction {DIRECTION}', motion_pointtowards:'point towards {TOWARDS}', motion_changexby:'change x by {DX}', motion_setx:'set x to {X}', motion_changeyby:'change y by {DY}', motion_sety:'set y to {Y}', motion_ifonedgebounce:'if on edge, bounce', motion_setrotationstyle:'set rotation style',
  looks_say:'say {MESSAGE}', looks_sayforsecs:'say {MESSAGE} for {SECS} seconds', looks_think:'think {MESSAGE}', looks_thinkforsecs:'think {MESSAGE} for {SECS} seconds', looks_switchcostumeto:'switch costume to {COSTUME}', looks_nextcostume:'next costume', looks_switchbackdropto:'switch backdrop to {BACKDROP}', looks_nextbackdrop:'next backdrop', looks_changesizeby:'change size by {CHANGE}%', looks_setsizeto:'set size to {SIZE}%', looks_show:'show', looks_hide:'hide', looks_gotofrontback:'go to {FRONT_BACK} layer', looks_goforwardbackwardlayers:'go {FORWARD_BACKWARD} {NUM} layers', looks_changeeffectby:'change {EFFECT} effect by {CHANGE}', looks_seteffectto:'set {EFFECT} effect to {VALUE}', looks_cleargraphiceffects:'clear graphic effects',
  sound_play:'start sound {SOUND_MENU}', sound_playuntildone:'play sound {SOUND_MENU} until done', sound_stopallsounds:'stop all sounds', sound_changevolumeby:'change volume by {VOLUME}', sound_setvolumeto:'set volume to {VOLUME}%',
  control_wait:'wait {DURATION} seconds', control_repeat:'repeat {TIMES}', control_forever:'forever', control_if:'if {CONDITION} then', control_if_else:'if {CONDITION} then / else', control_repeat_until:'repeat until {CONDITION}', control_wait_until:'wait until {CONDITION}', control_stop:'stop {STOP_OPTION}', control_create_clone_of:'create clone of {CLONE_OPTION}', control_delete_this_clone:'delete this clone',
  data_setvariableto:'set {VARIABLE} to {VALUE}', data_changevariableby:'change {VARIABLE} by {VALUE}', data_showvariable:'show variable {VARIABLE}', data_hidevariable:'hide variable {VARIABLE}', data_addtolist:'add {ITEM} to {LIST}', data_deleteoflist:'delete item {INDEX} of {LIST}', data_deletealloflist:'delete all of {LIST}', data_insertatlist:'insert {ITEM} at {INDEX} of {LIST}', data_replaceitemoflist:'replace item {INDEX} of {LIST} with {ITEM}', data_showlist:'show list {LIST}', data_hidelist:'hide list {LIST}',
  sensing_askandwait:'ask {QUESTION} and wait', sensing_answer:'answer', sensing_touchingobject:'touching {TOUCHINGOBJECTMENU}?', sensing_touchingcolor:'touching color {COLOR}?', sensing_keypressed:'key {KEY_OPTION} pressed?', sensing_mousedown:'mouse down?', sensing_mousex:'mouse x', sensing_mousey:'mouse y', sensing_timer:'timer', sensing_resettimer:'reset timer', sensing_dayssince2000:'days since 2000', sensing_username:'username',
  operator_add:'{NUM1} + {NUM2}', operator_subtract:'{NUM1} − {NUM2}', operator_multiply:'{NUM1} × {NUM2}', operator_divide:'{NUM1} ÷ {NUM2}', operator_random:'pick random {FROM} to {TO}', operator_gt:'{OPERAND1} > {OPERAND2}', operator_lt:'{OPERAND1} < {OPERAND2}', operator_equals:'{OPERAND1} = {OPERAND2}', operator_and:'{OPERAND1} and {OPERAND2}', operator_or:'{OPERAND1} or {OPERAND2}', operator_not:'not {OPERAND}', operator_join:'join {STRING1} {STRING2}', operator_letter_of:'letter {LETTER} of {STRING}', operator_length:'length of {STRING}', operator_contains:'{STRING1} contains {STRING2}?', operator_round:'round {NUM}', operator_mathop:'{OPERATOR} of {NUM}',
  procedures_definition:'define custom block', procedures_call:'custom block'
};
const FIELD_LABEL = {KEY_OPTION:'key',TOUCHINGOBJECTMENU:'object',COSTUME:'costume',BACKDROP:'backdrop',SOUND_MENU:'sound',VARIABLE:'variable',LIST:'list'};
function fieldValue(block, key) { const value = block.fields?.[key]; return Array.isArray(value) ? String(value[0] ?? '') : ''; }
function inputValue(block, key, blocks, seen = new Set()) {
  const input = block.inputs?.[key]; if (!Array.isArray(input)) return '';
  const source = input[1];
  if (typeof source === 'string') return expression(source, blocks, seen);
  if (Array.isArray(source)) return String(source[1] ?? '');
  if (Array.isArray(input[2])) return String(input[2][1] ?? '');
  return '';
}
function expression(id, blocks, seen = new Set()) {
  if (seen.has(id)) return '…'; const b = blocks[id]; if (!b) return '';
  const nextSeen = new Set(seen); nextSeen.add(id);
  const label = LABELS[b.opcode];
  if (label) return label.replace(/\{([A-Z0-9_]+)\}/g, (_, key) => inputValue(b, key, blocks, nextSeen) || fieldValue(b, key) || '…');
  const fields = Object.entries(b.fields || {}).map(([key]) => fieldValue(b, key)).filter(Boolean);
  const inputs = Object.keys(b.inputs || {}).filter((key) => !key.startsWith('SUBSTACK')).map((key) => inputValue(b, key, blocks, nextSeen)).filter(Boolean);
  return [...fields, ...inputs].join(' ') || humanOpcode(b.opcode);
}
function humanOpcode(opcode) { return String(opcode).replace(/^(motion|looks|sound|event|control|sensing|operator|data|procedures|argument|music|pen|videoSensing|text2speech)_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase(); }
function blockLabel(id, blocks, data) {
  const b = blocks[id]; if (!b) return 'unknown block';
  if (b.opcode === 'procedures_definition') {
    const protoId = b.inputs?.custom_block?.[1]; const proto = typeof protoId === 'string' ? blocks[protoId] : null;
    return proto?.mutation?.proccode || 'define custom block';
  }
  if (b.opcode === 'procedures_call') return b.mutation?.proccode || 'custom block';
  const label = LABELS[b.opcode];
  if (label) return label.replace(/\{([A-Z0-9_]+)\}/g, (_, key) => inputValue(b, key, blocks) || fieldValue(b, key) || '…');
  const fields = Object.entries(b.fields || {}).map(([key]) => fieldValue(b, key)).filter(Boolean);
  const inputs = Object.keys(b.inputs || {}).filter((key) => !key.startsWith('SUBSTACK')).map((key) => inputValue(b, key, blocks)).filter(Boolean);
  const known = humanOpcode(b.opcode);
  return [known, ...fields, ...inputs].join(' ');
}
function hatName(id, blocks, data) {
  const b = blocks[id]; if (!b) return 'Script';
  if (b.opcode === 'event_whenflagclicked') return 'When green flag clicked';
  if (b.opcode === 'event_whenkeypressed') return 'When key ' + (fieldValue(b, 'KEY_OPTION') || 'pressed');
  if (b.opcode === 'event_whenthisspriteclicked') return 'When this sprite clicked';
  if (b.opcode === 'event_whenbroadcastreceived') return 'When I receive “' + (fieldValue(b, 'BROADCAST_OPTION') || 'message') + '”';
  if (b.opcode === 'procedures_definition') return 'Custom block · ' + blockLabel(id, blocks, data);
  return blockLabel(id, blocks, data) || 'Script';
}
function renderScripts(data, blocks, scripts) {
  els.scripts.replaceChildren();
  if (!scripts.length) { const empty = document.createElement('div'); empty.className = 'empty-code'; empty.innerHTML = '<strong>No scripts found</strong>This sprite has no top-level Scratch blocks.'; els.scripts.append(empty); return; }
  scripts.forEach(([id, block]) => {
    const card = document.createElement('article'); card.className = 'script-card';
    const top = document.createElement('div'); top.className = 'script-top';
    const dot = document.createElement('i'); dot.className = 'script-dot';
    const title = document.createElement('strong'); title.textContent = hatName(id, blocks, data);
    const meta = document.createElement('span'); meta.className = 'script-meta'; meta.textContent = 'SCRIPT'; top.append(dot, title, meta);
    const body = document.createElement('div'); body.className = 'script-body';
    const lines = []; const seen = new Set();
    renderChain(id, 0, lines, blocks, seen, true);
    for (const line of lines) { const div = document.createElement('div'); div.className = 'code-line' + (line.depth ? ' nested' : ''); const indent = document.createElement('span'); indent.className = 'indent'; indent.textContent = '  '.repeat(Math.min(line.depth, 10)); const label = document.createElement('span'); label.className = 'block-label'; label.textContent = line.text; div.append(indent, label); body.append(div); }
    card.append(top, body); els.scripts.append(card);
  });
}
function renderChain(startId, depth, lines, blocks, seen, includeStart = false) {
  let id = startId;
  while (id && !seen.has(id) && blocks[id]) {
    const block = blocks[id]; seen.add(id);
    if (includeStart || depth > 0 || !block.topLevel) lines.push({ depth, text: blockLabel(id, blocks) });
    for (const [key, input] of Object.entries(block.inputs || {})) {
      if (!key.startsWith('SUBSTACK')) continue;
      const subId = Array.isArray(input) && typeof input[1] === 'string' ? input[1] : null;
      if (subId) renderChain(subId, depth + 1, lines, blocks, seen, true);
    }
    id = block.next;
    includeStart = true;
  }
}
