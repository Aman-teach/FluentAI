/* ============================================================
   FluentAI — English Coach (script file)
   Storage keys: es_settings, es_vocab, es_device_id
============================================================ */
const LS = {
  get(k,d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

const DEFAULT_KEY = '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';
const DEFAULT_ZEROG_KEY = 'sk-aee24ccc-250d-46b2-8000-7b2db778e6ed';
const DEFAULT_SUPABASE_URL = 'https://kzjttdpbfghyhwrxqxkt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6anR0ZHBiZmdoeWh3cnh4cWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzYzNzcsImV4cCI6MjA5NzExMjM3N30.6k3FF8hyw5chltXP9rdfDWKr43vXX6cQj41x1F6yqek';

let settings = LS.get('es_settings', {});
try{ if(!settings || typeof settings!=='object') settings={};
  settings.keys = settings.keys || {};
  settings.keys.nvidia = settings.keys.nvidia || DEFAULT_KEY;
  if(typeof settings.keys.openrouter!=='string') settings.keys.openrouter = '';
  if(typeof settings.keys.gemini!=='string') settings.keys.gemini = '';
  if(typeof settings.keys.zerog!=='string') settings.keys.zerog = DEFAULT_ZEROG_KEY;
  if(typeof settings.keys.deepgram!=='string') settings.keys.deepgram = '';
  settings.supabaseUrl = settings.supabaseUrl || DEFAULT_SUPABASE_URL;
  settings.supabaseAnonKey = settings.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
  if(settings._v!==7){ settings.provider='nvidia'; settings.model='meta/llama-3.3-70b-instruct'; settings.level='B1'; settings._v=7; }
  settings.provider = settings.provider || 'nvidia';
  settings.level = settings.level || 'B1';
  settings.rate = settings.rate || 0.95;
  settings.voiceURI = settings.voiceURI || '';
  delete settings.apiKey;
  LS.set('es_settings', settings);
}catch(e){ 
  settings.keys = settings.keys || {}; 
  settings.keys.nvidia = settings.keys.nvidia || DEFAULT_KEY; 
  settings.keys.openrouter = settings.keys.openrouter || ''; 
  settings.keys.gemini = settings.keys.gemini || ''; 
  settings.keys.zerog = settings.keys.zerog || DEFAULT_ZEROG_KEY;
  settings.keys.deepgram = '';
  settings.supabaseUrl = settings.supabaseUrl || DEFAULT_SUPABASE_URL; 
  settings.supabaseAnonKey = settings.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY; 
  settings.provider = settings.provider || 'nvidia'; 
  settings.model = settings.model || 'meta/llama-3.3-70b-instruct'; 
  settings.level = settings.level || 'B1'; 
  settings.rate = settings.rate || 0.95; 
}

function curKey(){ return (settings.keys && settings.keys[settings.provider]) || ''; }
let vocab = LS.get('es_vocab', []);
let supabaseClient = null;
let history = []; // {role, content} for the AI

let activeAudio = null; // Stored HTML5 Audio stream
let mediaRecorder = null; // MediaRecorder instance for mic
let audioChunks = []; // Audio segments
let listening = false;
let handsfree = false;
let silenceTimeout = null;

const $ = id => document.getElementById(id);
const setOrb = state => { const o = $('orb'); if (o) o.className = 'orb ' + state; };
const PROVIDERS = {
  gemini: { label:'Google Gemini (AI Studio)', url:'/api/gemini', keyHint:'AQ...', keyLink:'https://aistudio.google.com/', models:[
    ['gemini-2.5-flash','Gemini 2.5 Flash (Super Fast & Free)'],
    ['gemini-2.0-flash','Gemini 2.0 Flash (Fast & Free)'],
    ['gemini-1.5-flash','Gemini 1.5 Flash (Stable & Free)']
  ]},
  openrouter: { label:'OpenRouter', url:'https://openrouter.ai/api/v1/chat/completions', keyHint:'sk-or-v1-...', keyLink:'https://openrouter.ai/keys', models:[
    ['openrouter/free','Auto Free Router (Recommended)'],
    ['meta-llama/llama-3.3-70b-instruct:free','Llama 3.3 70B (free)'],
    ['google/gemini-2.0-flash-exp:free','Gemini 2.0 Flash (free)'],
    ['deepseek/deepseek-chat-v3-0324:free','DeepSeek V3 (free)'],
    ['qwen/qwen-2.5-72b-instruct:free','Qwen 2.5 72B (free)']
  ]},
  nvidia: { label:'NVIDIA NIM', url:'/api/nvidia', keyHint:'nvapi-...', keyLink:'https://build.nvidia.com/', models:[
    ['meta/llama-3.3-70b-instruct','Llama 3.3 70B (Recommended)'],
    ['nvidia/llama-3.3-nemotron-super-49b-v1.5','Nemotron Super 49B (Smarter)'],
    ['nvidia/nvidia-nemotron-nano-9b-v2','Nemotron Nano 9B (Fastest)'],
    ['qwen/qwen2.5-7b-instruct','Qwen 2.5 7B (Fast)'],
    ['deepseek-ai/deepseek-v3.1','DeepSeek V3.1 (Smarter)']
  ]},
  zerog: { label:'0G Private Computer', url:'/api/zerog', keyHint:'sk-...', keyLink:'https://pc.0g.ai/', models:[
    ['minimax-m3','MiniMax M3 (Decentralized Speech/NIM)'],
    ['deepseek-v3','DeepSeek V3 (0G Router)'],
    ['qwen3.7-max','Qwen 3.7 Max (0G Router)']
  ]}
};

function populateModels(){
  const prov=PROVIDERS[settings.provider]||PROVIDERS.nvidia;
  $('apiKey').placeholder=prov.keyHint;
  $('model').innerHTML=prov.models.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join('');
  if(prov.models.some(m=>m[0]===settings.model)){ $('model').value=settings.model; } else { settings.model=prov.models[0][0]; $('model').value=settings.model; }
  const kh=$('keyHint'); if(kh){ kh.innerHTML='Get a key at <a href="'+prov.keyLink+'" target="_blank">'+prov.keyLink.replace(/^https?:\/\//,'').replace(/\/$/,'')+'</a>. Stored locally.'; }
}

function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200); }

function getDeviceId(){
  let id = LS.get('es_device_id', '');
  if(!id){
    id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('device-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    LS.set('es_device_id', id);
  }
  return id;
}

function initSupabase(){
  supabaseClient = null;
  const url = (settings.supabaseUrl || DEFAULT_SUPABASE_URL || '').trim();
  const key = (settings.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY || '').trim();
  if(!window.supabase || !url || !key) return false;
  try{
    supabaseClient = window.supabase.createClient(url, key);
    return true;
  }catch(e){
    console.warn('Supabase init failed', e);
    supabaseClient = null;
    return false;
  }
}

function normalizeVocabRow(row){
  return {
    id: String(row.id),
    word: row.word || '',
    meaning: row.meaning || '',
    example: row.example || '',
    phonetic: row.phonetic || '',
    box: Number(row.box || 0),
    added: row.added ? Number(row.added) : Date.now(),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

async function loadVocabFromSupabase(){
  if(!supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from('vocabulary_words')
    .select('*')
    .eq('browser_id', getDeviceId())
    .order('added', { ascending: false });
  if(error) throw error;
  if(Array.isArray(data)){
    vocab = data.map(normalizeVocabRow);
    LS.set('es_vocab', vocab);
    return true;
  }
  return false;
}

async function upsertVocabToSupabase(item){
  if(!supabaseClient) return;
  const payload = {
    id: String(item.id),
    browser_id: getDeviceId(),
    word: item.word || '',
    meaning: item.meaning || '',
    example: item.example || '',
    phonetic: item.phonetic || '',
    box: Number(item.box || 0),
    added: Number(item.added || Date.now()),
    updated_at: new Date().toISOString()
  };
  const { error } = await supabaseClient.from('vocabulary_words').upsert(payload, { onConflict: 'id' });
  if(error) throw error;
}

async function deleteVocabFromSupabase(id){
  if(!supabaseClient) return;
  const { error } = await supabaseClient.from('vocabulary_words').delete().eq('id', String(id)).eq('browser_id', getDeviceId());
  if(error) throw error;
}

async function loadVocabData(){
  const localVocab = LS.get('es_vocab', []);
  vocab = Array.isArray(localVocab) ? localVocab : [];
  if(!supabaseClient) return;
  try{
    const loaded = await loadVocabFromSupabase();
    if(!loaded && vocab.length){
      await Promise.all(vocab.map(upsertVocabToSupabase));
    }
  }catch(e){
    console.warn('Supabase vocab sync failed, using local cache', e);
  }
}

/* ---------- Navigation ---------- */
document.querySelectorAll('.nav button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $('screen-'+b.dataset.screen).classList.add('active');
  };
});

/* ---------- Settings UI ---------- */
function refreshKeyPill(){
  const p=$('keyPill');
  const hasKey = !!curKey();
  if(hasKey){
    p.textContent='AI connected'; p.className='pill ok';
    const sTitle = $('settingsStatusTitle');
    if (sTitle) {
      sTitle.textContent = 'Connected';
      sTitle.style.color = '#FFFFFF';
      $('settingsStatusDesc').textContent = `AI Provider is set to ${PROVIDERS[settings.provider]?.label || settings.provider}. Key is active and saved locally.`;
    }
  } else {
    if (settings.provider === 'openrouter') {
      p.textContent='No API key'; p.className='pill warn';
      const sTitle = $('settingsStatusTitle');
      if (sTitle) {
        sTitle.textContent = 'Disconnected';
        sTitle.style.color = '#F87171';
        $('settingsStatusDesc').textContent = 'Please configure your OpenRouter API Key to enable voice translation and AI feedback.';
      }
    } else {
      p.textContent='Proxy Mode'; p.className='pill warn';
      const sTitle = $('settingsStatusTitle');
      if (sTitle) {
        sTitle.textContent = 'Active (Server Env)';
        sTitle.style.color = '#F59E0B'; // Amber
        $('settingsStatusDesc').textContent = `Running via server-side keys for ${PROVIDERS[settings.provider]?.label || settings.provider}. Add your own key below to override.`;
      }
    }
  }
}

function loadSettingsUI(){
  $('provider').value=settings.provider||'openrouter';
  $('apiKey').value=curKey();
  populateModels();
  $('level').value=settings.level||'B1';
  $('rate').value=settings.rate||0.95;
  $('dgKey').value=settings.keys?.deepgram||'';
  $('supabaseUrl').value=settings.supabaseUrl||DEFAULT_SUPABASE_URL;
  $('supabaseAnonKey').value=settings.supabaseAnonKey||DEFAULT_SUPABASE_ANON_KEY;
  refreshKeyPill();
}

$('provider').onchange=()=>{ settings.provider=$('provider').value; $('apiKey').value=curKey(); populateModels(); refreshKeyPill(); LS.set('es_settings',settings); };
$('saveSettings').onclick=()=>{
  settings.provider=$('provider').value;
  settings.keys=settings.keys||{};
  let key = $('apiKey').value.trim();
  if(settings.provider==='nvidia' && key && !key.startsWith('nvapi-')){
    key='nvapi-'+key;
    $('apiKey').value=key;
  }
  settings.keys[settings.provider]=key;
  settings.keys.deepgram=$('dgKey').value.trim();
  settings.model=$('model').value;
  settings.level=$('level').value;
  settings.rate=parseFloat($('rate').value);
  settings.supabaseUrl=$('supabaseUrl').value.trim();
  settings.supabaseAnonKey=$('supabaseAnonKey').value.trim();
  LS.set('es_settings',settings); refreshKeyPill(); toast('Settings saved ✓');
  initSupabase();
  loadVocabData().then(()=>{ renderVocab(); updateStats(); }).catch(()=>{});
};
$('level').onchange=()=>{ settings.level=$('level').value; LS.set('es_settings',settings); };
$('rate').onchange=()=>{ settings.rate=parseFloat($('rate').value); LS.set('es_settings',settings); };
$('dgKey').onchange=()=>{ 
  settings.keys=settings.keys||{};
  settings.keys.deepgram=$('dgKey').value.trim(); 
  LS.set('es_settings',settings); 
};

$('testKey').onclick=async()=>{
  if(!$('apiKey').value.trim()){ toast('Paste your key first'); return; }
  settings.provider=$('provider').value; settings.keys=settings.keys||{};
  let key = $('apiKey').value.trim();
  if(settings.provider==='nvidia' && key && !key.startsWith('nvapi-')){
    key='nvapi-'+key;
    $('apiKey').value=key;
  }
  settings.keys[settings.provider]=key;
  settings.model=$('model').value;
  toast('Testing...');
  try{
    const r=await callAI([{role:'user',content:'Reply with just the word: ok'}], false);
    toast(r ? 'Connection works ✓' : 'No response — try another model');
  }catch(e){ toast('Failed: '+e.message); }
};

/* ---------- Deepgram Text to Speech (TTS) ---------- */
async function speak(text){
  if(!text.trim()) return;
  
  if(activeAudio) {
    try {
      activeAudio.pause();
    } catch(e){}
    activeAudio = null;
  }
  
  setOrb('thinking');
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    
    // Add Client-side Deepgram key if provided, otherwise server proxy falls back to env variable
    const clientKey = settings.keys?.deepgram || '';
    if(clientKey) {
      headers['Authorization'] = 'Bearer ' + clientKey;
    }
    
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ text })
    });
    
    if(!res.ok) {
      throw new Error('Deepgram voice generation failed');
    }
    
    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    
    activeAudio = new Audio(audioUrl);
    
    activeAudio.onplaying = () => {
      setOrb('speaking');
    };
    
    activeAudio.onended = () => {
      setOrb('');
      activeAudio = null;
      URL.revokeObjectURL(audioUrl);
      if(handsfree) {
        setTimeout(() => startListen(), 350);
      }
    };
    
    activeAudio.onerror = (e) => {
      setOrb('');
      activeAudio = null;
      URL.revokeObjectURL(audioUrl);
      console.error('Audio stream error', e);
      toast('Speech playback error');
    };
    
    activeAudio.play();
  } catch(err) {
    setOrb('');
    console.error('Deepgram speak request failed', err);
    toast('Deepgram voice stream failed');
  }
}

/* ---------- AI call ---------- */
async function callAI(messages, expectJSON){
  if(settings.provider === 'openrouter' && !curKey()) {
    throw new Error('Add your API key in Settings');
  }
  const headers = { 
    'Content-Type': 'application/json', 
    'HTTP-Referer': location.href, 
    'X-Title': 'FluentAI English Coach' 
  };
  if (curKey()) {
    headers['Authorization'] = 'Bearer ' + curKey();
  }
  const res=await fetch((PROVIDERS[settings.provider]||PROVIDERS.nvidia).url,{
    method:'POST',
    headers: headers,
    body:JSON.stringify({ model:settings.model, messages, temperature:0.5, max_tokens:500 })
  });
  if(!res.ok){
    const t=await res.text();
    if(res.status===401){
      throw new Error("API key is invalid or missing. If you're hosting this app, make sure to add GEMINI_API_KEY / NVIDIA_API_KEY / ZEROG_API_KEY in your server environment variables, or enter your own key in Settings.");
    }
    if(res.status===429){
      throw new Error("Rate limit reached (429). The free model is busy. Please try again in a moment, select a different model in Settings, or use a paid key.");
    }
    if(res.status===503){
      throw new Error("Service overloaded (503). Google's free servers are currently experiencing high traffic. Please select a different model (like Gemini 2.0 Flash or 1.5 Flash) in Settings, or try again in a few seconds.");
    }
    throw new Error('API '+res.status+' '+t.slice(0,120));
  }
  const data=await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function coachSystemPrompt(){
  const lvl=settings.level||'auto';
  const lvlLine = lvl==='auto'
    ? "Detect the learner's proficiency from how they actually speak and mirror it. Assume a capable, fluent adult unless they are clearly a beginner — never talk down to them or oversimplify."
    : `The learner's CEFR level is ${lvl}. Match your vocabulary and pace to that level.`;
  return `You are a sharp, genuinely engaging English conversation partner and coach on a live voice call. ${lvlLine}

TOPIC & ROLEPLAY FLUIDITY:
- The learner may choose to start a roleplay scenario (which will be seeded as the first user message in the history) or do a free chat.
- If there is a roleplay prompt in the chat history, follow it. 
- However, if the user changes the subject, goes off-topic, or starts a free-flowing conversation, you MUST immediately and fully pivot to their new topic. Do NOT attempt to force them back to the scenario roleplay, and do not reference the previous scenario. Follow the user's lead 100%.

HOW TO TALK:
- Respond naturally and substantively to the content of what the user says. Speak like a smart, friendly peer (1-3 sentences), followed by one natural question to keep the conversation going.

EXTREMELY RIGOROUS COACHING & CORRECTIONS:
- The learner wants continuous, highly rigorous feedback. You must analyze their input with extreme scrutiny for ANY grammatical errors, awkward word choices, incorrect prepositions, incorrect collocations, or unnatural structures.
- IMPORTANT: You MUST correct stuttered/repetitive words, incomplete thoughts, tense errors, and poorly structured sentences. Do not let broken or stuttered speech pass as perfect.
- If a sentence is understandable but sounds clumsy, rigid, or non-native, you MUST correct it to a clean, natural, and idiomatic phrasing.

EXAMPLES OF SPEECH CORRECTIONS:

Example 1 (Stuttered Speech & Tense):
Input: "I was speaking in a room but but but but but but the problem because I cannot learn English I don't I thought I learn English"
Output JSON:
{
  "reply": "I understand how frustrating that can feel. Language learning is a journey, and it's completely normal to feel stuck. You're doing great just by speaking and practicing!",
  "corrections": [
    {
      "original": "but but but but but but",
      "corrected": "but",
      "note": "Remove stuttered/repeated words for natural speech flow."
    },
    {
      "original": "the problem because I cannot learn English I don't I thought I learn English",
      "corrected": "the problem is that I cannot learn English. I thought I would learn English",
      "note": "Corrected awkward structure and verb tense ('thought I would learn' instead of 'thought I learn')."
    }
  ],
  "vocab": []
}

Example 2 (Grammar & Awkward Phrasing):
Input: "I am going going I am very going bad to feel it man"
Output JSON:
{
  "reply": "I'm really sorry to hear that you're feeling down. What's making you feel bad today? I'm here to listen if you want to talk about it.",
  "corrections": [
    {
      "original": "I am going going",
      "corrected": "I am",
      "note": "Removed the repeated word 'going'."
    },
    {
      "original": "I am very going bad to feel it man",
      "corrected": "I am feeling very bad, man / I feel really bad, man",
      "note": "Corrected word order and verb choice. In English, we say 'I feel bad' or 'I am feeling bad' rather than 'going bad to feel it'."
    }
  ],
  "vocab": []
}

Return ONLY valid minified JSON, no markdown, exactly in this format. If you identify useful new vocabulary words in the learner's or your response, suggest them in the "vocab" list and include their "word", "phonetic" (IPA transcription e.g. /rɪˈzɪliənt/), and "meaning". Use empty arrays when there is nothing worth flagging.`;
}

function parseAI(raw){
  if(!raw) return null;
  let s=raw.trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim();
  const a=s.indexOf('{'), b=s.lastIndexOf('}');
  if(a>=0 && b>a) s=s.slice(a,b+1);
  try{ return JSON.parse(s); }catch(e){ return { reply: raw, corrections:[], vocab:[] }; }
}

/* ---------- Chat rendering ---------- */
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function addUserBubble(text, lowConfidenceWords = []){
  const c=$('chat'); const d=document.createElement('div'); d.className='msg user';
  
  if (Array.isArray(lowConfidenceWords) && lowConfidenceWords.length > 0) {
    let html = escapeHTML(text);
    // Unique the low confidence words (case-insensitive) to prevent duplicate highlight wrapping
    const uniqueWords = [...new Set(lowConfidenceWords.map(w => w.toLowerCase()))];
    uniqueWords.forEach(word => {
      if(!word.trim()) return;
      try {
        const regex = new RegExp(`\\b(${escapeRegex(word)})\\b`, 'gi');
        html = html.replace(regex, `<span class="low-conf-word" title="Pronunciation warning: low confidence">$1</span>`);
      } catch(e){}
    });
    d.innerHTML = html;
  } else {
    d.textContent = text;
  }
  
  c.appendChild(d); scrollChat();
}
function addAIBubble(text){
  const c=$('chat'); const d=document.createElement('div'); d.className='msg ai';
  d.innerHTML=`<div>${escapeHTML(text)}</div><div class="replay">🔊 Tap to replay</div>`;
  d.querySelector('.replay').onclick=()=>speak(text);
  c.appendChild(d); scrollChat();
}
function addCorrections(corr){
  const c=$('chat');
  if(!corr || corr.length===0){
    const p=document.createElement('div'); p.className='perfect-card';
    p.innerHTML=`<span style="display:inline-flex; align-items:center; gap:6px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Perfect — no mistakes that time!</span>`;
    c.appendChild(p); scrollChat(); return;
  }
  const d=document.createElement('div'); d.className='corr-card';
  let h=`<div class="h" style="display:flex; align-items:center; gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Quick corrections</div>`;
  corr.forEach(x=>{
    h+=`<div class="corr-item"><span class="was">${escapeHTML(x.original||'')}</span> → <span class="fix">${escapeHTML(x.corrected||'')}</span><span class="why">${escapeHTML(x.note||'')}</span></div>`;
  });
  d.innerHTML=h; c.appendChild(d); scrollChat();
}
function addVocabSuggestions(vs){
  if(!vs || !vs.length) return;
  const c=$('chat');
  vs.forEach(v=>{
    if(!v.word) return;
    const d=document.createElement('div'); d.className='corr-card'; d.style.background='var(--blue-bg)';
    d.innerHTML=`<div class="h" style="color:var(--blue); display:flex; align-items:center; gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> New word</div><b>${escapeHTML(v.word)}</b> ${v.phonetic?`<span class="vphon">${escapeHTML(v.phonetic)}</span>`:''} — ${escapeHTML(v.meaning||'')}<br><button class="add-vocab-mini">+ Save to my vocabulary</button>`;
    d.querySelector('button').onclick=()=>{ saveVocab(v.word, v.meaning||'', '', v.phonetic||''); toast('Added "'+v.word+'" ✓'); };
    c.appendChild(d);
  });
  scrollChat();
}
function scrollChat(){ const s=$('screen-call'); if(s) s.scrollTop=s.scrollHeight; const c=$('chat'); if(c) c.scrollTop=c.scrollHeight; }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Conversation flow ---------- */
async function handleUserSpeech(text, lowConfidenceWords = []){
  if(!text.trim()) return;
  addUserBubble(text, lowConfidenceWords);
  
  let userMessageContent = text;
  if (Array.isArray(lowConfidenceWords) && lowConfidenceWords.length > 0) {
    userMessageContent += `\n\n[Pronunciation / Accent warning: The user spoke these words with low acoustic confidence: ${lowConfidenceWords.map(w => `"${w}"`).join(', ')}. Scrutinize their pronunciation, accent, or clarity in your response, and gently advise them on how to improve if relevant.]`;
  }
  
  history.push({role:'user', content: userMessageContent});
  setOrb('thinking'); $('coachStatus').textContent='Thinking...';
  try{
    const msgs=[{role:'system',content:coachSystemPrompt()}, ...history.slice(-10)];
    const raw=await callAI(msgs, true);
    const out=parseAI(raw);
    const reply=out.reply || "Sorry, could you say that again?";
    history.push({role:'assistant', content:reply});
    addAIBubble(reply);
    addCorrections(out.corrections);
    addVocabSuggestions(out.vocab);
    $('coachStatus').textContent='Your turn — tap to reply.';
    speak(reply);
  }catch(e){
    setOrb(''); $('coachStatus').textContent='⚠️ '+e.message;
    addAIBubble('⚠️ '+e.message);
  }
}

/* ---------- Deepgram Speech to Text (STT) ---------- */
async function startListen(){
  if(listening) return;
  audioChunks = [];
  
  if(activeAudio) {
    try {
      activeAudio.pause();
    } catch(e){}
    activeAudio = null;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Choose standard container format supported universally
    let options = {};
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' };
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      options = { mimeType: 'audio/ogg' };
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      audioChunks = [];
      
      // Turn off mic hardware
      stream.getTracks().forEach(t => t.stop());
      
      setOrb('thinking');
      $('coachStatus').textContent = 'Transcribing your voice...';
      
      try {
        const headers = {};
        const clientKey = settings.keys?.deepgram || '';
        if(clientKey) {
          headers['Authorization'] = 'Bearer ' + clientKey;
        }
        headers['Content-Type'] = audioBlob.type || 'audio/webm';
        
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: headers,
          body: audioBlob
        });
        
        if(!res.ok) {
          throw new Error('Speech transcription failed');
        }
        
        const data = await res.json();
        const alternative = data.results?.channels?.[0]?.alternatives?.[0];
        const transcription = alternative?.transcript || '';
        const words = alternative?.words || [];
        
        // Identify low-confidence words (less than 80% confidence)
        const lowConfidenceWords = words
          .filter(w => typeof w.confidence === 'number' && w.confidence < 0.80)
          .map(w => w.word);
        
        if (transcription.trim()) {
          handleUserSpeech(transcription, lowConfidenceWords);
        } else {
          setOrb('');
          $('coachStatus').textContent = "Didn't catch that. Tap the mic to speak again.";
        }
      } catch(err) {
        setOrb('');
        $('coachStatus').textContent = '⚠️ Speech analysis failed: ' + err.message;
        toast('STT Proxy Failed');
      }
    };
    
    listening = true;
    setOrb('listening');
    $('coachStatus').textContent = 'Listening... speak now';
    $('micBtn').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></svg><span>Tap to stop</span>';
    $('micBtn').classList.add('rec');
    
    mediaRecorder.start(250); // Fetch chunks in intervals
    
    // Safety auto-stop timers
    clearTimeout(silenceTimeout);
    if (!handsfree) {
      silenceTimeout = setTimeout(() => {
        if (listening) stopListen();
      }, 10000); // Max 10 seconds recording per sentence in tap-to-talk
    } else {
      silenceTimeout = setTimeout(() => {
        if (listening) stopListen();
      }, 7000); // 7 seconds in hands-free mode
    }
    
  } catch(e) {
    listening = false;
    setOrb('');
    $('coachStatus').textContent = '⚠️ Microphone blocked. Allow microphone permission in address bar and reload.';
    toast('Mic blocked');
  }
}

function stopListen(){
  if(!listening) return;
  listening = false;
  clearTimeout(silenceTimeout);
  setOrb('');
  $('micBtn').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg><span>Tap to speak</span>';
  $('micBtn').classList.remove('rec');
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch(e){}
  }
}

$('micBtn').onclick=()=>{ if(listening) stopListen(); else startListen(); };
$('handsfreeBtn').onclick=()=>{
  handsfree=!handsfree;
  $('handsfreeBtn').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Call: '+(handsfree?'On':'Off')+'</span>';
  if(handsfree && !listening) startListen();
};
$('clearChat').onclick=()=>{ 
  if(activeAudio) { activeAudio.pause(); activeAudio = null; }
  history=[]; 
  $('chat').innerHTML=''; 
  $('coachStatus').textContent='Conversation cleared. Tap to talk.'; 
};

$('enableMic').onclick=async()=>{
  try{
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      const s=await navigator.mediaDevices.getUserMedia({audio:true});
      s.getTracks().forEach(t=>t.stop());
      toast('Microphone enabled ✓'); 
      $('coachStatus').textContent='Mic ready — tap "Tap to speak" to start.';
    } else { 
      toast('Allow mic in browser'); 
    }
  }catch(e){ 
    $('coachStatus').textContent='Microphone permission denied. Enable it in the browser settings and reload.'; 
  }
};

function sendTyped(){ const v=$('typeInput').value.trim(); if(!v) return; $('typeInput').value=''; handleUserSpeech(v); }
$('sendText').onclick=sendTyped;
$('typeInput').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); sendTyped(); } };

/* ---------- Scenarios ---------- */
const SCENARIOS=[
  {t:'01 / Free chat', p:''},
  {t:'02 / Small talk', p:'Let\'s have casual small talk. Ask me about my day.'},
  {t:'03 / Pitch a client', p:'Role-play: you are a dermatologist clinic owner. I am pitching my content service. Start by greeting me.'},
  {t:'04 / At the airport', p:'Role-play a situation at the airport check-in counter. You are the staff.'},
  {t:'05 / Restaurant', p:'Role-play ordering food at a restaurant. You are the waiter.'},
  {t:'06 / Job interview', p:'Role-play a job interview. You are the interviewer. Ask me the first question.'}
];

function renderScenarios(){
  const row=$('scenarioRow');
  row.innerHTML=SCENARIOS.map((s,i)=>`<button class="chip${i===0?' sel':''}" data-i="${i}">${s.t}</button>`).join('');
  row.querySelectorAll('.chip').forEach(c=>{
    c.onclick=()=>{
      row.querySelectorAll('.chip').forEach(x=>x.classList.remove('sel')); c.classList.add('sel');
      const s=SCENARIOS[+c.dataset.i];
      if(activeAudio) { activeAudio.pause(); activeAudio = null; }
      history=[]; $('chat').innerHTML='';
      if(s.p){ history.push({role:'user',content:s.p}); $('coachStatus').textContent='Starting: '+s.t+'...'; kickoff(); }
      else { $('coachStatus').textContent='Free chat — tap the mic and say anything.'; }
    };
  });
}

async function kickoff(){
  if(settings.provider==='openrouter' && !curKey()){ addAIBubble('⚠️ Add your free API key in Settings to start talking.'); return; }
  setOrb('thinking');
  try{
    const msgs=[{role:'system',content:coachSystemPrompt()}, ...history];
    const out=parseAI(await callAI(msgs,true));
    history.push({role:'assistant',content:out.reply});
    addAIBubble(out.reply); $('coachStatus').textContent='Your turn — tap the mic.'; speak(out.reply);
  }catch(e){ setOrb(''); addAIBubble('⚠️ '+e.message); }
}

/* ============================================================
   VOCABULARY
============================================================ */
function saveVocab(word, meaning, example, phonetic){
  const w=word.trim(); if(!w) return;
  const ex=vocab.find(v=>v.word.toLowerCase()===w.toLowerCase());
  const ph=(phonetic||'').trim();
  if(ex){ 
    ex.meaning=meaning||ex.meaning; 
    ex.example=example||ex.example; 
    if(ph) ex.phonetic=ph;
    void upsertVocabToSupabase(ex).catch(err=>console.warn('Supabase sync failed on save', err));
  } else {
    const item = { id:String(Date.now()+Math.random()), word:w, meaning:meaning||'', example:example||'', phonetic:ph, box:0, added:Date.now() };
    vocab.push(item);
    void upsertVocabToSupabase(item).catch(err=>console.warn('Supabase sync failed on save', err));
  }
  LS.set('es_vocab',vocab); renderVocab(); updateStats();
}

function updateStats(){
  $('stTotal').textContent=vocab.length;
  $('stReview').textContent=vocab.filter(v=>v.box<2).length;
  $('stMaster').textContent=vocab.filter(v=>v.box>=3).length;
}

function boxTag(b){ if(b>=3) return '<span class="tag mastered">Mastered</span>'; if(b>=1) return '<span class="tag review">Reviewing</span>'; return '<span class="tag learning">Learning</span>'; }

function renderVocab(){
  const q=($('vocabSearch').value||'').toLowerCase();
  const items=vocab.filter(v=>v.word.toLowerCase().includes(q)||(v.meaning||'').toLowerCase().includes(q)).sort((a,b)=>b.added-a.added);
  const box=$('vocabItems');
  if(!items.length){ box.innerHTML='<div class="empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px; display:block; opacity:0.6;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3.5A2.5 2.5 0 0 1 6.5 1H20v16H6.5a2.5 2.5 0 0 0-2.5 2.5z"/></svg>No words yet. Tap <b>+ Add</b> or save words from your coach chat.</div>'; return; }
  box.innerHTML=items.map(v=>`
    <div class="vcard">
      <div class="top">
        <div class="vword-box">
          <span class="vword">${escapeHTML(v.word)}</span>
          ${v.phonetic?`<span class="vphon">${escapeHTML(v.phonetic)}</span>`:''}
        </div>
        <div class="acts">
          <button class="iconbtn" onclick="speakWord('${escapeAttr(v.word)}')" title="Hear word"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
          <button class="iconbtn" onclick="editWord('${v.id}')" title="Edit word"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="iconbtn" onclick="delWord('${v.id}')" title="Delete word"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
        </div>
      </div>
      ${v.meaning?`<div class="vmean">${escapeHTML(v.meaning)}</div>`:''}
      ${v.example?`<div class="vex">"${escapeHTML(v.example)}"</div>`:''}
      <div style="margin-top:auto; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap;">
        ${boxTag(v.box)}
      </div>
    </div>`).join('');
}

function escapeAttr(s){ return (s||'').replace(/'/g,"\\'"); }
function speakWord(w){
  speak(w); // Leverage high-quality Deepgram Aura voice for vocabulary pronunciation
}
window.speakWord=speakWord;
window.delWord=id=>{ 
  vocab=vocab.filter(v=>String(v.id)!==String(id)); 
  LS.set('es_vocab',vocab); 
  renderVocab(); 
  updateStats(); 
  void deleteVocabFromSupabase(id).catch(err=>console.warn('Supabase sync failed on delete', err));
};
window.editWord=id=>{ const v=vocab.find(x=>String(x.id)===String(id)); if(v) openWordModal(v); };

/* word modal */
let editing=null;
function openWordModal(v){
  editing=v||null;
  $('wordModalTitle').textContent=v?'Edit word':'Add a word';
  $('wWord').value=v?v.word:'';
  $('wPhon').value=v?v.phonetic||'':'';
  $('wMean').value=v?v.meaning:'';
  $('wEx').value=v?v.example:'';
  $('wordModal').classList.add('open');
}
function closeWordModal(){ $('wordModal').classList.remove('open'); editing=null; }
$('addWordBtn').onclick=()=>openWordModal(null);
$('wCancel').onclick=closeWordModal;
$('wordModal').onclick=e=>{ if(e.target===$('wordModal')) closeWordModal(); };
$('wSave').onclick=()=>{
  const w=$('wWord').value.trim(); if(!w){ toast('Enter a word'); return; }
  const ph=$('wPhon').value.trim();
  if(editing){ 
    editing.word=w; 
    editing.phonetic=ph; 
    editing.meaning=$('wMean').value.trim(); 
    editing.example=$('wEx').value.trim(); 
    LS.set('es_vocab',vocab); renderVocab(); updateStats(); 
    void upsertVocabToSupabase(editing).catch(err=>console.warn('Supabase sync failed on edit', err));
  }
  else saveVocab(w,$('wMean').value.trim(),$('wEx').value.trim(),ph);
  closeWordModal(); toast('Saved ✓');
};

$('wDefine').onclick=async()=>{
  const w=$('wWord').value.trim(); if(!w){ toast('Type a word first'); return; }
  $('wDefine').disabled=true;
  
  let found = false;
  $('wDefine').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;" class="thinking-spinner"><circle cx="12" cy="12" r="10" stroke-dasharray="10 6"/></svg><span>Searching Dictionary...</span>';
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const phonetic = item.phonetic || item.phonetics?.find(p => p.text)?.text || '';
        
        let meaning = '';
        let example = '';
        
        if (item.meanings && item.meanings.length > 0) {
          const firstMeaning = item.meanings[0];
          if (firstMeaning.definitions && firstMeaning.definitions.length > 0) {
            meaning = firstMeaning.definitions[0].definition || '';
            example = firstMeaning.definitions[0].example || '';
          }
        }
        
        if (meaning) {
          $('wMean').value = meaning;
          $('wPhon').value = phonetic;
          $('wEx').value = example;
          found = true;
          toast('Fetched from Dictionary ✓');
        }
      }
    }
  } catch (e) {
    console.warn('Dictionary API error, falling back to AI:', e);
  }
  
  if (!found) {
    if(!curKey()){ 
      toast('Not in dictionary — add API key in Settings for AI definition'); 
    } else {
      $('wDefine').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg><span>AI Defining...</span>';
      try {
        const raw = await callAI([{
          role: 'user', 
          content: `Define the English word/phrase "${w}" for an English learner (CEFR level: ${settings.level||'auto'}). Return ONLY minified JSON: {"meaning":"simple short definition","phonetic":"IPA phonetic transcription (e.g. /rɪ\\'zɪliənt/)","example":"one natural example sentence"}`
        }], true);
        const o = parseAI(raw);
        if (o.meaning) $('wMean').value = o.meaning;
        if (o.phonetic) $('wPhon').value = o.phonetic;
        if (o.example) $('wEx').value = o.example;
        toast('Fetched from AI ✓');
      } catch (e) {
        toast('Failed: ' + e.message);
      }
    }
  }
  
  $('wDefine').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg><span>Auto-define with AI</span>';
  $('wDefine').disabled=false;
};

/* speak-to-add (using browser webkitSpeechRecognition locally) */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$('wSpeak').onclick=()=>{
  if(!SR){ toast('Voice needs Chrome/Edge'); return; }
  const r=new SR(); r.lang='en-US'; r.interimResults=false;
  $('wSpeak').innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#991B1B" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="12" r="8"/></svg>';
  r.onresult=e=>{
    $('wWord').value=e.results[0][0].transcript;
    $('wSpeak').innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
  };
  r.onerror=()=>{
    $('wSpeak').innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
  };
  r.onend=()=>{
    $('wSpeak').innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
  };
  try{ r.start(); }catch(e){}
};

/* vocab mode toggle */
document.querySelectorAll('#vocabSeg button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#vocabSeg button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const quiz=b.dataset.mode==='quiz';
    $('vocabList').style.display=quiz?'none':'block';
    $('vocabQuiz').style.display=quiz?'block':'none';
    if(quiz) startQuiz();
  };
});

/* ---------- Flashcard quiz ---------- */
let quizDeck=[], quizIdx=0;
function startQuiz(){
  quizDeck=[...vocab].sort((a,b)=>a.box-b.box || Math.random()-0.5);
  quizIdx=0;
  if(!quizDeck.length){ $('vocabQuiz').innerHTML='<div class="empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px; display:block; opacity:0.6;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Add some words first, then practice them here.</div>'; return; }
  renderQuizCard();
}

function renderQuizCard(){
  if(quizIdx>=quizDeck.length){
    $('vocabQuiz').innerHTML=`<div class="empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px; display:block; opacity:0.6;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>Session done! You reviewed ${quizDeck.length} words.<br><br><button onclick="startQuiz()">Practice again</button></div>`; updateStats(); return;
  }
  const v=quizDeck[quizIdx];
  $('vocabQuiz').innerHTML=`
    <div class="quiz-progress">Card ${quizIdx+1} of ${quizDeck.length}</div>
    <div class="flash" id="flash">
      <div class="flash-inner">
        <div class="flash-face">
          <div class="lbl">What does this mean?</div>
          <div class="big">${escapeHTML(v.word)}</div>
          <button class="ghost" onclick="event.stopPropagation(); speakWord('${escapeAttr(v.word)}')"><span style="display:inline-flex; align-items:center; gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Hear it</span></button>
          <div class="lbl" style="margin-top:6px;">Tap card to flip</div>
        </div>
        <div class="flash-face flash-back">
          <div class="lbl">Meaning</div>
          <div class="mid">${escapeHTML(v.meaning||'(no definition saved)')}</div>
          ${v.example?`<div class="vex">"${escapeHTML(v.example)}"</div>`:''}
        </div>
      </div>
    </div>
    <div class="quiz-actions">
      <button class="btn-bad" onclick="gradeCard(false)"><span style="display:inline-flex; align-items:center; gap:6px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Didn't know</span></button>
      <button class="btn-good" onclick="gradeCard(true)"><span style="display:inline-flex; align-items:center; gap:6px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Got it</span></button>
    </div>`;
  $('flash').onclick=()=>$('flash').classList.toggle('flip');
}
window.gradeCard=ok=>{
  const v=quizDeck[quizIdx];
  v.box = ok ? Math.min((v.box||0)+1,4) : 0;
  LS.set('es_vocab',vocab);
  void upsertVocabToSupabase(v).catch(err=>console.warn('Supabase update failed', err));
  quizIdx++; renderQuizCard();
};
window.startQuiz=startQuiz;

/* ---------- Export / Import ---------- */
$('exportBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify(vocab,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='my-vocabulary.json'; a.click();
};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{ const arr=JSON.parse(r.result); if(Array.isArray(arr)){ arr.forEach(x=>{ if(x.word) saveVocab(x.word,x.meaning,x.example,x.phonetic||''); }); toast('Imported ✓'); } }catch(err){ toast('Invalid file'); } }; r.readAsText(f);
};

/* ---------- Init ---------- */
async function initApp() {
  loadSettingsUI();
  renderScenarios();
  
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      if (config.supabaseUrl && config.supabaseAnonKey) {
        if (!settings.supabaseUrl || settings.supabaseUrl === DEFAULT_SUPABASE_URL) {
          settings.supabaseUrl = config.supabaseUrl;
        }
        if (!settings.supabaseAnonKey || settings.supabaseAnonKey === DEFAULT_SUPABASE_ANON_KEY) {
          settings.supabaseAnonKey = config.supabaseAnonKey;
        }
        if ($('supabaseUrl')) $('supabaseUrl').value = settings.supabaseUrl;
        if ($('supabaseAnonKey')) $('supabaseAnonKey').value = settings.supabaseAnonKey;
      }
    }
  } catch (e) {
    console.warn('Failed to load server configuration, using local/hardcoded defaults', e);
  }

  initSupabase();
  try {
    await loadVocabData();
  } catch (e) {
    console.warn('Failed to load vocabulary data', e);
  }
  renderVocab();
  updateStats();

  if(!curKey() && settings.provider==='openrouter'){ 
    $('coachStatus').textContent='Welcome! Open Settings, keep provider on OpenRouter, paste your free key, then type or tap the mic to talk.'; 
  } else if(!curKey()){
    $('coachStatus').textContent='Welcome! You can enter your own API key in Settings, or chat directly if server environment keys are configured.';
  }
}

initApp();
