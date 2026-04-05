const STORE_KEY='shoplist_v1';
let state={categories:[],shoppingDone:{}};
let currentTab='shopping';
let currentCatId=null;
let searchQ='';

function loadState(){
  try{const s=localStorage.getItem(STORE_KEY);if(s)state=JSON.parse(s);}catch(e){}
  if(!state.categories)state.categories=[];
  if(!state.shoppingDone)state.shoppingDone={};
}
function saveState(){localStorage.setItem(STORE_KEY,JSON.stringify(state));}

function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

function fmtDate(){
  const d=new Date();
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yy=String(d.getFullYear()).slice(2);
  const hh=String(d.getHours()).padStart(2,'0');
  const min=String(d.getMinutes()).padStart(2,'0');
  return `${dd}-${mm}-${yy} ${hh}${min}`;
}

/* ---- RENDER ---- */
function render(){
  currentTab==='shopping'?renderShopping():renderMaster();
}

/* ======= SHOPPING LIST ======= */
function renderShopping(){
  document.getElementById('header-title').textContent='🛒 Shopping List';
  const cats=state.categories;
  const allItems=[];
  cats.forEach(c=>c.subcategories&&c.subcategories.forEach(sc=>sc.items&&sc.items.forEach(it=>{
    if(it.ticked)allItems.push({...it,catName:c.name,scName:sc.name,catId:c.id,scId:sc.id});
  })));

  if(!allItems.length){
    document.getElementById('content').innerHTML=`
      <div class="action-bar"><div class="spacer"></div><button class="btn btn-danger btn-sm" id="sl-reset">↺ Reset</button></div>
      <div class="empty"><div class="empty-icon">🛒</div><p>No items ticked in Master.<br>Tick items to add them here.</p></div>`;
    document.getElementById('sl-reset').onclick=()=>resetShoppingList();
    return;
  }

  const grouped={};
  allItems.forEach(it=>{
    const k=it.catId;
    if(!grouped[k])grouped[k]={catName:it.catName,subs:{}};
    const sk=it.scId;
    if(!grouped[k].subs[sk])grouped[k].subs[sk]={scName:it.scName,items:[]};
    grouped[k].subs[sk].items.push(it);
  });

  const sortedCats=Object.keys(grouped).sort((a,b)=>grouped[a].catName.localeCompare(grouped[b].catName));
  let total=allItems.length,done=allItems.filter(it=>state.shoppingDone[it.id]).length;

  let html=`<div class="action-bar">
    <span style="font-size:13px;color:var(--text2)"><b>${done}</b>/${total} done</span>
    <div class="spacer"></div>
    <button class="btn btn-danger btn-sm" id="sl-reset">↺ Reset List</button>
  </div>`;

  sortedCats.forEach(cid=>{
    const cg=grouped[cid];
    const sortedSubs=Object.keys(cg.subs).sort((a,b)=>cg.subs[a].scName.localeCompare(cg.subs[b].scName));
    const catDone=sortedSubs.every(sid=>cg.subs[sid].items.every(it=>state.shoppingDone[it.id]));
    html+=`<div class="card">
      <div class="card-header" onclick="toggleSection('slcat-${cid}')">
        <span class="card-title">${esc(cg.catName)}</span>
        ${catDone?'<span class="badge badge-green">✓</span>':''}
        <span class="chevron open" id="chev-slcat-${cid}">▶</span>
      </div>
      <div id="slcat-${cid}" class="card-body">`;
    sortedSubs.forEach(sid=>{
      const sg=cg.subs[sid];
      const sortedItems=[...sg.items].sort((a,b)=>a.name.localeCompare(b.name));
      html+=`<div class="subcat-section">
        <div class="subcat-header" onclick="toggleSection('slsc-${sid}')">
          <span class="subcat-title">${esc(sg.scName)}</span>
          <span class="chevron open" id="chev-slsc-${sid}">▶</span>
        </div>
        <div id="slsc-${sid}" class="subcat-body">`;
      sortedItems.forEach(it=>{
        const done2=!!state.shoppingDone[it.id];
        html+=`<div class="sl-item${done2?' sl-done':''}">
          <input type="checkbox" class="sl-check" ${done2?'checked':''} onchange="toggleShoppingDone('${it.id}',this.checked)">
          <span class="sl-label">${esc(it.name)}${it.qty?`<span class="sl-qty">${esc(it.qty)} ${esc(it.uom||'')}</span>`:''}
          </span>
        </div>`;
      });
      html+=`</div></div>`;
    });
    html+=`</div></div>`;
  });

  document.getElementById('content').innerHTML=html;
  document.getElementById('sl-reset').onclick=()=>resetShoppingList();
}

function toggleShoppingDone(id,val){
  if(val)state.shoppingDone[id]=true;
  else delete state.shoppingDone[id];
  saveState();renderShopping();
}
function resetShoppingList(){
  if(confirm('Reset shopping list? This will untick all items and clear the list.')){
    state.shoppingDone={};
    state.categories.forEach(c=>c.subcategories&&c.subcategories.forEach(sc=>sc.items&&sc.items.forEach(it=>{it.ticked=false;})));
    saveState();renderShopping();
  }
}

/* ======= MASTER ======= */
function renderMaster(){
  document.getElementById('header-title').textContent='📦 Master';
  if(currentCatId){renderCatDetail();return;}
  renderCatGrid();
}

function renderCatGrid(){
  document.getElementById('master-detail') && (document.getElementById('master-detail').style.display='none');
  const cats=state.categories;
  let html=`<div class="search-wrap"><span class="search-icon">🔍</span><input type="text" placeholder="Search items..." value="${esc(searchQ)}" oninput="onSearch(this.value)" id="search-input"></div>`;

  if(searchQ.trim()){renderSearchResults(html);return;}

  html+=`<div class="cat-grid">`;
  cats.forEach(c=>{
    const total=c.subcategories&&c.subcategories.reduce((a,sc)=>a+(sc.items?sc.items.length:0),0)||0;
    const ticked=c.subcategories&&c.subcategories.reduce((a,sc)=>a+(sc.items?sc.items.filter(i=>i.ticked).length:0),0)||0;
    html+=`<div class="cat-card" onclick="openCat('${c.id}')">
      <div class="cat-icon">${c.icon||'📁'}</div>
      <div class="cat-name">${esc(c.name)}</div>
      <div class="cat-count">${ticked}/${total} ticked</div>
    </div>`;
  });
  html+=`<div class="cat-card" style="border:1.5px dashed var(--border);background:#fafafa" onclick="showAddCat()">
    <div class="cat-icon">➕</div><div class="cat-name" style="color:var(--text2)">Add Category</div>
  </div></div>`;
  document.getElementById('content').innerHTML=html;
}

function renderSearchResults(prefix){
  const q=searchQ.trim().toLowerCase();
  let html=prefix;
  const results=[];
  state.categories.forEach(c=>c.subcategories&&c.subcategories.forEach(sc=>sc.items&&sc.items.forEach(it=>{
    if(it.name.toLowerCase().includes(q))results.push({...it,catName:c.name,scName:sc.name,catId:c.id,scId:sc.id});
  })));
  if(!results.length){html+=`<div class="empty"><div class="empty-icon">🔍</div><p>No items found for "${esc(searchQ)}"</p></div>`;}
  else{
    html+=`<div class="section-label">${results.length} result${results.length>1?'s':''}</div>`;
    results.forEach(it=>{
      html+=`<div class="card"><div class="item-row" style="padding:12px 14px">
        <input type="checkbox" class="item-check" ${it.ticked?'checked':''} onchange="tickItem('${it.catId}','${it.scId}','${it.id}',this.checked)">
        <span class="item-label ${it.ticked?'checked-label':''}">${esc(it.name)}<span class="uom">${it.qty||''}${it.uom?' '+esc(it.uom):''}</span><br><span style="font-size:11px;color:var(--text3)">${esc(it.catName)} › ${esc(it.scName)}</span></span>
        <button class="item-delete" onclick="deleteItem('${it.catId}','${it.scId}','${it.id}')">🗑</button>
      </div></div>`;
    });
  }
  document.getElementById('content').innerHTML=html;
}

function onSearch(v){searchQ=v;renderMaster();}

function openCat(id){currentCatId=id;renderMaster();}

function renderCatDetail(){
  const cat=state.categories.find(c=>c.id===currentCatId);
  if(!cat){currentCatId=null;renderMaster();return;}
  let html=`<button class="back-btn" onclick="backToGrid()">◀ All Categories</button>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h2 style="font-size:16px;font-weight:600">${cat.icon||'📁'} ${esc(cat.name)}</h2>
    <button class="btn btn-danger btn-xs" onclick="deleteCat('${cat.id}')">Delete Cat</button>
  </div>`;

  const subs=cat.subcategories||[];
  subs.forEach(sc=>{
    const items=sc.items||[];
    html+=`<div class="card" style="margin-bottom:10px">
      <div class="card-header" onclick="toggleSection('sc-${sc.id}')">
        <span class="card-title">${esc(sc.name)}</span>
        <span class="badge">${items.filter(i=>i.ticked).length}/${items.length}</span>
        <button class="btn btn-danger btn-xs" style="margin-left:4px" onclick="event.stopPropagation();deleteSubcat('${cat.id}','${sc.id}')">✕</button>
        <span class="chevron open" id="chev-sc-${sc.id}" style="margin-left:4px">▶</span>
      </div>
      <div id="sc-${sc.id}" class="card-body">`;
    items.forEach(it=>{
      html+=`<div class="item-row">
        <input type="checkbox" class="item-check" ${it.ticked?'checked':''} onchange="tickItem('${cat.id}','${sc.id}','${it.id}',this.checked)">
        <span class="item-label ${it.ticked?'checked-label':''}">${esc(it.name)}<span class="uom">${it.qty||''}${it.uom?' '+esc(it.uom):''}</span></span>
        <button class="item-delete" onclick="confirmDeleteItem('${cat.id}','${sc.id}','${it.id}','${esc(it.name)}')">🗑</button>
      </div>`;
    });
    html+=`<div class="add-row"><button class="btn btn-outline btn-sm" onclick="showAddItem('${cat.id}','${sc.id}')">+ Add Item</button></div>
      </div></div>`;
  });

  html+=`<div class="add-row"><button class="btn btn-primary btn-sm" onclick="showAddSubcat('${cat.id}')">+ Add Subcategory</button></div>`;
  document.getElementById('content').innerHTML=html;
}

function backToGrid(){currentCatId=null;renderMaster();}

function toggleSection(id){
  const el=document.getElementById(id);
  const ch=document.getElementById('chev-'+id);
  if(!el)return;
  const hidden=el.classList.toggle('collapsed');
  if(ch)ch.classList.toggle('open',!hidden);
}

/* ---- MODALS ---- */
function showModal(html){
  let ov=document.createElement('div');
  ov.className='modal-overlay';ov.id='modal-overlay';
  ov.innerHTML=`<div class="modal">${html}</div>`;
  ov.onclick=e=>{if(e.target===ov)closeModal();};
  document.body.appendChild(ov);
}
function closeModal(){const m=document.getElementById('modal-overlay');if(m)m.remove();}

function showAddCat(){
  showModal(`<h3>New Category</h3>
    <div class="modal-row"><input id="m-cat-name" placeholder="Category name" autofocus></div>
    <div class="modal-row"><input id="m-cat-icon" placeholder="Icon emoji (optional)" style="max-width:80px">
    <select id="m-cat-icon-pick" onchange="document.getElementById('m-cat-icon').value=this.value" style="flex:1">
      <option value="">Pick icon</option>
      ${['🥦','🍖','🥛','🧁','🧴','🏠','👕','📦','🐾','💊','🍹','🛒'].map(i=>`<option value="${i}">${i}</option>`).join('')}
    </select></div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="addCat()">Add</button>
    </div>`);
}
function addCat(){
  const name=document.getElementById('m-cat-name').value.trim();
  const icon=document.getElementById('m-cat-icon').value.trim()||'📁';
  if(!name)return alert('Enter a name');
  if(state.categories.find(c=>c.name.toLowerCase()===name.toLowerCase()))return alert('Category exists');
  state.categories.push({id:genId(),name,icon,subcategories:[]});
  saveState();closeModal();renderMaster();
}
function deleteCat(cid){
  if(confirm('Delete this category and all its items?')){
    state.categories=state.categories.filter(c=>c.id!==cid);
    currentCatId=null;saveState();renderMaster();
  }
}
function showAddSubcat(cid){
  showModal(`<h3>New Subcategory</h3>
    <div class="modal-row"><input id="m-sc-name" placeholder="Subcategory name" autofocus></div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="addSubcat('${cid}')">Add</button>
    </div>`);
}
function addSubcat(cid){
  const name=document.getElementById('m-sc-name').value.trim();
  if(!name)return alert('Enter a name');
  const cat=state.categories.find(c=>c.id===cid);
  if(!cat)return;
  if(cat.subcategories&&cat.subcategories.find(s=>s.name.toLowerCase()===name.toLowerCase()))return alert('Subcategory exists');
  if(!cat.subcategories)cat.subcategories=[];
  cat.subcategories.push({id:genId(),name,items:[]});
  saveState();closeModal();renderCatDetail();
}
function deleteSubcat(cid,sid){
  if(confirm('Delete this subcategory and all its items?')){
    const cat=state.categories.find(c=>c.id===cid);
    if(cat)cat.subcategories=cat.subcategories.filter(s=>s.id!==sid);
    saveState();renderCatDetail();
  }
}
function showAddItem(cid,sid){
  const cat=state.categories.find(c=>c.id===cid);
  showModal(`<h3>New Item</h3>
    <div class="modal-row"><input id="m-it-name" placeholder="Item name" autofocus></div>
    <div class="modal-row">
      <input id="m-it-qty" placeholder="Qty" style="max-width:80px">
      <select id="m-it-uom">
        <option value="">UOM</option>
        ${['pcs','kg','g','l','ml','pack','dozen','box','bottle','bag','can'].map(u=>`<option value="${u}">${u}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="addItem('${cid}','${sid}')">Add</button>
    </div>`);
}
function addItem(cid,sid){
  const name=document.getElementById('m-it-name').value.trim();
  const qty=document.getElementById('m-it-qty').value.trim();
  const uom=document.getElementById('m-it-uom').value;
  if(!name)return alert('Enter item name');
  const cat=state.categories.find(c=>c.id===cid);
  if(!cat)return;
  const allCatItems=cat.subcategories&&cat.subcategories.flatMap(s=>s.items||[]);
  if(allCatItems&&allCatItems.find(i=>i.name.toLowerCase()===name.toLowerCase()))return alert('Item already exists in this category');
  const sc=cat.subcategories&&cat.subcategories.find(s=>s.id===sid);
  if(!sc)return;
  if(!sc.items)sc.items=[];
  sc.items.push({id:genId(),name,qty,uom,ticked:false});
  saveState();closeModal();renderCatDetail();
}
function confirmDeleteItem(cid,sid,iid,name){
  if(confirm(`Delete "${name}"?`))deleteItem(cid,sid,iid);
}
function deleteItem(cid,sid,iid){
  const cat=state.categories.find(c=>c.id===cid);
  if(!cat)return;
  const sc=cat.subcategories&&cat.subcategories.find(s=>s.id===sid);
  if(!sc)return;
  sc.items=sc.items.filter(i=>i.id!==iid);
  delete state.shoppingDone[iid];
  saveState();renderMaster();
}
function tickItem(cid,sid,iid,val){
  const cat=state.categories.find(c=>c.id===cid);
  const sc=cat&&cat.subcategories&&cat.subcategories.find(s=>s.id===sid);
  const it=sc&&sc.items&&sc.items.find(i=>i.id===iid);
  if(it){it.ticked=val;saveState();}
}

/* ---- EXPORT / IMPORT ---- */
function exportCSV(){
  const rows=[['Category','Subcategory','Item','Qty','UOM','Ticked']];
  state.categories.forEach(c=>c.subcategories&&c.subcategories.forEach(sc=>sc.items&&sc.items.forEach(it=>{
    rows.push([c.name,sc.name,it.name,it.qty||'',it.uom||'',it.ticked?'1':'0']);
  })));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`ShopList_${fmtDate().replace(':','')}.csv`;a.click();
  URL.revokeObjectURL(url);
}
function importCSV(){
  const input=document.createElement('input');
  input.type='file';input.accept='.csv';
  input.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const lines=ev.target.result.split('\n').filter(l=>l.trim());
        lines.shift();
        lines.forEach(line=>{
          const cols=line.match(/(".*?"|[^,]+)(?=,|$)/g)||[];
          const clean=cols.map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"'));
          const [catName,scName,itName,qty,uom,ticked]=clean;
          if(!catName||!scName||!itName)return;
          let cat=state.categories.find(c=>c.name===catName);
          if(!cat){cat={id:genId(),name:catName,icon:'📁',subcategories:[]};state.categories.push(cat);}
          let sc=cat.subcategories.find(s=>s.name===scName);
          if(!sc){sc={id:genId(),name:scName,items:[]};cat.subcategories.push(sc);}
          if(!sc.items.find(i=>i.name===itName))
            sc.items.push({id:genId(),name:itName,qty:qty||'',uom:uom||'',ticked:ticked==='1'});
        });
        saveState();render();alert('Import complete!');
      }catch(e){alert('Import failed: '+e.message);}
    };r.readAsText(f);
  };input.click();
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ---- TABS ---- */
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    currentTab=t.dataset.tab;
    currentCatId=null;searchQ='';
    render();
  };
});
document.getElementById('btn-export').onclick=exportCSV;
document.getElementById('btn-import').onclick=importCSV;

loadState();render();