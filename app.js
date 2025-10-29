// ===== 模擬試験 完全版（インデックス自動判定 + 50問全解説固定表示） =====
const NUM_QUESTIONS = 50;
const filesToLoad = ['questions_part1.json','questions_part2.json','questions_part3.json','questions_part4.json'];

const $ = s => document.querySelector(s);
const scrSetup=$('#screen-setup'), scrQuiz=$('#screen-quiz'), scrResult=$('#screen-result');
const startBtn=$('#startBtn'), nextBtn=$('#nextBtn'), prevBtn=$('#prevBtn');
const retryBtn=$('#retryBtn'), reviewWrongBtn=$('#reviewWrongBtn'), showExplainBtn=$('#showExplainBtn');
const progressEl=$('#progress'), modeHintEl=$('#modeHint'), questionText=$('#questionText'), choicesWrap=$('#choices');
const scoreText=$('#scoreText'), explainList=$('#explainList'), explainItems=$('#explainItems');

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;}
function uniqById(arr){ const s=new Set(); return arr.filter(x=>x && !s.has(x.id) && s.add(x.id)); }
function idxToMark(i){ return ['①','②','③','④','⑤'][i] ?? `(${i+1})`; }
const esc = s => String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

// 状態
let bank=[], quiz=[], cursor=0, userAns=[], correct=0, reviewMode=false;
// 直近の「本試験50問」を保持（全解説は常にこちらを表示）
let lastExamSet=null, lastExamUserAns=null;

function normalizeAnswerIndex(arr){
  if(!arr.length) return;
  const sample = arr.slice(0, Math.min(50, arr.length));
  const allNum = sample.every(q=>q && typeof q.answer==='number');
  const hasZero = sample.some(q=>q && q.answer===0);
  const looksOneBased = allNum && !hasZero;
  if(looksOneBased){ arr.forEach(q=>{ if(typeof q.answer==='number') q.answer -= 1; }); }
}

async function loadBank(){
  let all=[];
  for(const f of filesToLoad){
    try{
      const res = await fetch(`${f}?v=rev9`);
      if(!res.ok) continue;
      const arr = await res.json();
      if(Array.isArray(arr)) all = all.concat(arr);
    }catch(e){}
  }
  normalizeAnswerIndex(all);
  all = all.filter(q=>q && q.question && Array.isArray(q.choices) && typeof q.answer==='number' && q.choices[q.answer]!=null);
  all = uniqById(all);

  // 選択肢シャッフル（正解追随）
  all.forEach(q=>{
    const idx = q.choices.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]]; }
    const shuffled = idx.map(i=>q.choices[i]);
    const newAnswer = idx.indexOf(q.answer);
    q.choices = shuffled; q.answer = newAnswer;
  });
  return all;
}

function pickQuiz(fromList){
  const src = fromList ?? bank;
  const n = Math.min(NUM_QUESTIONS, src.length);
  quiz = shuffle([...src]).slice(0,n);
  cursor=0; userAns=new Array(n).fill(null); correct=0;
  reviewMode = !!fromList;
  modeHintEl.classList.toggle('hidden', !reviewMode);
}

function renderQuestion(){
  const q = quiz[cursor];
  progressEl.textContent = `${cursor+1} / ${quiz.length}`;
  questionText.textContent = `Q${cursor+1}. ${q.question}`;
  choicesWrap.innerHTML='';

  q.choices.forEach((raw,i)=>{
    const cleaned = String(raw).replace(/^([①-⑤]|[1-5][\.\s、）)]\s*)/,'').trim();
    const div = document.createElement('div'); div.className='choice';
    if(userAns[cursor]===i) div.classList.add('selected');

    const mk = document.createElement('span'); mk.className='mk'; mk.textContent=idxToMark(i);
    const lab = document.createElement('span'); lab.className='label'; lab.innerHTML=esc(cleaned);
    div.appendChild(mk); div.appendChild(lab);

    div.addEventListener('click',()=>{ [...choicesWrap.children].forEach(c=>c.classList.remove('selected')); div.classList.add('selected'); userAns[cursor]=i; nextBtn.disabled=false; });
    choicesWrap.appendChild(div);
  });

  nextBtn.disabled = userAns[cursor]==null;
  prevBtn.disabled = cursor===0;
}

function renderExplanations(sourceQuiz, sourceUser){
  explainItems.innerHTML='';
  sourceQuiz.forEach((q,i)=>{
    const ua = sourceUser[i];
    const ok = ua===q.answer;
    const you = ua==null ? '未回答' : `${idxToMark(ua)} ${q.choices[ua]}`;
    const ca  = `${idxToMark(q.answer)} ${q.choices[q.answer]}`;
    const li = document.createElement('li');
    li.innerHTML = `
      <div><strong>Q${i+1}.</strong> ${esc(q.question)}</div>
      <div>あなたの回答：${esc(you)} ${ok?'✅':'❌'}</div>
      <div>正解：${esc(ca)}</div>
      <span class="muted">解説：${esc(q.explanation||'')}</span>
    `;
    explainItems.appendChild(li);
  });
  explainList.classList.remove('hidden');
}

function finish(){
  correct = 0; quiz.forEach((q,i)=>{ if(userAns[i]===q.answer) correct++; });

  // 本試験のときだけ、50問セットを保持（全解説ボタンは常にこれを表示）
  if(!reviewMode){
    lastExamSet     = quiz.slice();
    lastExamUserAns = userAns.slice();
  }

  scrQuiz.classList.add('hidden');
  scrResult.classList.remove('hidden');
  scoreText.textContent = `結果：${correct} / ${quiz.length}（正答率 ${(correct*100/quiz.length).toFixed(1)}%）`;

  // 初期状態は解説を閉じる
  explainList.classList.add('hidden');
}

startBtn.addEventListener('click', async ()=>{
  startBtn.disabled=true;
  try{
    bank = await loadBank();
    if(bank.length===0) throw new Error('no data');
    pickQuiz();
    scrSetup.classList.add('hidden'); scrQuiz.classList.remove('hidden');
    renderQuestion();
  }catch(e){
    alert('問題データの読み込みに失敗しました。ファイル配置と形式を確認してください。');
    startBtn.disabled=false;
  }
});

nextBtn.addEventListener('click', ()=>{ if(cursor<quiz.length-1){ cursor++; renderQuestion(); } else { finish(); } });
prevBtn.addEventListener('click', ()=>{ if(cursor>0){ cursor--; renderQuestion(); }});

retryBtn.addEventListener('click', ()=>{ pickQuiz(); scrResult.classList.add('hidden'); scrQuiz.classList.remove('hidden'); renderQuestion(); });

reviewWrongBtn.addEventListener('click', ()=>{
  // 現在の結果から「間違いのみ」を抽出
  const wrong=[]; quiz.forEach((q,i)=>{ if(userAns[i]!==q.answer) wrong.push(q); });
  if(!wrong.length){ alert('間違えた問題はありません。'); return; }
  // 注意：lastExamSet は保持したまま。以降の全解説は常に lastExamSet を表示
  pickQuiz(wrong);
  scrResult.classList.add('hidden'); scrQuiz.classList.remove('hidden');
  renderQuestion();
});

showExplainBtn.addEventListener('click', ()=>{
  // 常に「直近の本試験50問」を表示（復習モード中でも固定）
  const srcQ = lastExamSet ?? quiz;
  const srcA = lastExamUserAns ?? userAns;
  renderExplanations(srcQ, srcA);
});
