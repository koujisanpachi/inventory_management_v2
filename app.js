(() => {
  "use strict";
  const DEFAULT_CATEGORIES = [
    {id:"electrical",name:"電材",icon:"🔌",desc:"電気・配線関連部材",order:0},
    {id:"water",name:"水部材",icon:"🔧",desc:"配管・バルブ関連部材",order:1},
    {id:"refrigeration",name:"冷凍部材",icon:"❄️",desc:"冷媒・冷凍機関連部材",order:2},
    {id:"other",name:"その他",icon:"📦",desc:"その他の備品・消耗品",order:3}
  ];
  const ICON_OPTIONS = ["🔌","🔧","🪛","🔩","🧰","⚡","❄️","🧊","🚰","🪠","🧪","📦","🛠️","💡","🔋","🧯","🚿","⚙️","📏","🪜","🧲","🧵","🪚","🗜️"];
  let CATEGORIES = [...DEFAULT_CATEGORIES];
  let db, currentCategory = null, selectedItemId = null, stocktake = null;
  let currentUser = null;
  let appStarted = false;
  let appStarting = false;
  const $ = id => document.getElementById(id);
  const now = () => new Date().toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-"+Date.now()+"-"+Math.random().toString(16).slice(2));
  const categoryName = id => CATEGORIES.find(c=>c.id===id)?.name || "その他";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const collection = name => db.collection(name);
  async function getAll(name){const snap=await collection(name).get();return snap.docs.map(d=>d.data())}
  async function getOne(name,id){const doc=await collection(name).doc(String(id)).get();return doc.exists?doc.data():undefined}
  async function put(name,obj){await collection(name).doc(String(obj.id)).set({...obj,updatedBy:currentUser?.name||"不明",updatedByPin:currentUser?.pin||""},{merge:true});return obj.id}
  async function del(name,id){await collection(name).doc(String(id)).delete()}
  async function clear(name){const snap=await collection(name).get();let batch=db.batch();let count=0;for(const d of snap.docs){batch.delete(d.ref);count++;if(count===400){await batch.commit();batch=db.batch();count=0}}if(count)await batch.commit()}
  async function loadCategories(){
    const rows=await getAll("categories");
    if(rows.length)CATEGORIES=rows.sort((a,b)=>(a.order??0)-(b.order??0));
    else {CATEGORIES=[...DEFAULT_CATEGORIES];for(const c of CATEGORIES)await collection("categories").doc(c.id).set(c)}
  }
  function setLoginMessage(msg){$("loginMessage").textContent=msg}
  function showLogin(error=""){
    $("loginView").classList.remove("hidden");
    $("userStrip").classList.add("hidden");
    $("app").classList.add("hidden");
    $("pinPanel").classList.add("hidden");
    $("googleLoginBtn").classList.remove("hidden");
    $("loginError").textContent=error;
    setLoginMessage("共有在庫に接続しています。");
  }
  function showPinPanel(){
    $("loginView").classList.remove("hidden");
    $("userStrip").classList.add("hidden");
    $("app").classList.add("hidden");
    $("pinPanel").classList.remove("hidden");
    $("googleLoginBtn").classList.add("hidden");
    $("loginError").textContent="";
    setLoginMessage("Google認証済みです。自分のPINを入力してください。");
    $("pinInput").focus();
  }
  function authErrorMessage(error){
    const messages={
      "auth/unauthorized-domain":"このサイトのドメインがFirebaseで承認されていません。Authorized domainsを確認してください。",
      "auth/operation-not-allowed":"FirebaseでGoogleログインが有効になっていません。",
      "auth/network-request-failed":"通信に失敗しました。通信環境を確認して、もう一度お試しください。",
      "auth/web-storage-unsupported":"このブラウザでは認証情報を保存できません。通常のブラウザ画面で開いてください。",
      "auth/redirect-cancelled-by-user":"Googleログインがキャンセルされました。",
      "auth/redirect-operation-pending":"Googleログイン処理がすでに進行中です。画面を再読み込みしてください。"
    };
    return messages[error?.code] || (error?.message || "原因不明の認証エラーです。");
  }
  async function startGoogleLogin(){
    try{
      const auth=firebase.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const provider=new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({prompt:"select_account"});
      await auth.signInWithRedirect(provider);
    }catch(e){
      console.error("Google sign-in failed",e);
      showLogin("Googleログインに失敗しました："+authErrorMessage(e));
    }
  }
  async function verifyPin(){
    if(!firebase.auth().currentUser){showLogin("Google認証が切れています。もう一度ログインしてください。");return}
    const pin=$("pinInput").value.trim();
    const match=(window.INVENTORY_USERS||[]).find(u=>u.pin===pin);
    if(!match){$("loginError").textContent="PINが一致しません。4桁を確認してください。";return}
    currentUser={name:match.name,pin:match.pin};
    sessionStorage.setItem("inventoryUser",JSON.stringify(currentUser));
    try{await enterApp()}catch(e){console.error(e);$("loginError").textContent="在庫データの読み込みに失敗しました："+e.message}
  }
  async function enterApp(){
    // すでに初期化済みなら、利用者名だけ切り替えて画面を戻す。
    if(appStarted){
      $("currentUserLabel").textContent=currentUser.name;
      $("loginView").classList.add("hidden");$("userStrip").classList.remove("hidden");$("app").classList.remove("hidden");
      return;
    }
    if(appStarting)return;
    appStarting=true;
    try{
      db=firebase.firestore();
      await loadCategories();
      setup();refreshCategorySelectors();renderHome();
      $("currentUserLabel").textContent=currentUser.name;
      $("loginView").classList.add("hidden");$("userStrip").classList.remove("hidden");$("app").classList.remove("hidden");
      appStarted=true;
    }finally{appStarting=false}
  }
  function toast(message){const t=$("toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300)}
  function showView(id){document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(id).classList.remove("hidden");window.scrollTo(0,0)}
  function goHome(){currentCategory=null;showView("homeView");renderHome()}
  function categoryItems(categoryId){return getAll("items").then(a=>a.filter(x=>x.categoryId===categoryId).sort((x,y)=>x.name.localeCompare(y.name,"ja")))}
  function formatDate(value){return new Intl.DateTimeFormat("ja-JP",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
  function renderHome(){
    getAll("items").then(items=>{
      $("categoryGrid").innerHTML=CATEGORIES.map(c=>{
        const list=items.filter(i=>i.categoryId===c.id);
        const total=list.reduce((n,i)=>n+Number(i.quantity||0),0);
        return `<button class="category-card" data-category="${c.id}"><span class="cat-icon">${c.icon}</span><span><b>${c.name}</b><small>${list.length}商品 ・ 在庫合計 ${total}</small></span></button>`;
      }).join("");
      $("categoryGrid").querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>openCategory(b.dataset.category)));
    });
  }
  async function openCategory(id){
    currentCategory=id;const c=CATEGORIES.find(x=>x.id===id);
    $("categoryTitle").textContent=c.name;$("categorySummary").textContent=c.desc;
    $("categorySearch").value="";showView("categoryView");await renderCategory();
  }
  async function renderCategory(){
    const q=$("categorySearch").value.trim().toLowerCase();
    const items=await categoryItems(currentCategory);
    const filtered=items.filter(i=>[i.name,i.model,i.maker,i.location].join(" ").toLowerCase().includes(q));
    $("categoryCount").textContent=`${filtered.length}商品`;
    $("categoryItems").innerHTML=filtered.length?filtered.map(itemCard).join(""):`<div class="empty">商品がまだ登録されていません。<br>「商品登録」から追加できます。</div>`;
    $("categoryItems").querySelectorAll("[data-item]").forEach(b=>b.addEventListener("click",()=>showDetail(b.dataset.item)));
  }
  function itemCard(i){
    return `<button class="item-card" data-item="${escapeHtml(i.id)}"><span class="item-top"><span><span class="item-name">${escapeHtml(i.name)}</span><span class="item-meta">${i.model?"型番："+escapeHtml(i.model):"型番未登録"}${i.maker?" ・ "+escapeHtml(i.maker):""}</span></span><span class="item-qty"><strong>${escapeHtml(i.quantity)}</strong><small>${escapeHtml(i.unit||"個")}</small></span></span><span class="item-tags">${i.location?`<span class="tag">${escapeHtml(i.location)}</span>`:""}${i.note?`<span class="tag">備考あり</span>`:""}</span></button>`;
  }
  function openItemDialog(item=null){
    $("itemForm").reset();$("editId").value=item?.id||"";
    $("itemDialogTitle").textContent=item?"商品編集":"商品登録";
    $("itemCategory").innerHTML=CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
    $("itemCategory").value=item?.categoryId||currentCategory||"electrical";
    $("itemName").value=item?.name||"";$("itemModel").value=item?.model||"";$("itemMaker").value=item?.maker||"";
    $("itemQty").value=item?.quantity??0;$("itemUnit").value=item?.unit||"個";$("itemLocation").value=item?.location||"";$("itemNote").value=item?.note||"";
    $("itemDialog").showModal();
  }
  async function saveItem(e){
    e.preventDefault();
    const id=$("editId").value||uid();const old=await getOne("items",id);
    const item={id,categoryId:$("itemCategory").value,name:$("itemName").value.trim(),model:$("itemModel").value.trim(),maker:$("itemMaker").value.trim(),quantity:Number($("itemQty").value),unit:$("itemUnit").value.trim()||"個",location:$("itemLocation").value.trim(),note:$("itemNote").value.trim(),createdAt:old?.createdAt||now(),updatedAt:now()};
    if(!item.name||!Number.isFinite(item.quantity)||item.quantity<0){toast("品名と在庫数を確認してください");return}
    await put("items",item);$("itemDialog").close();toast("商品を保存しました");
    if(currentCategory)await renderCategory();renderHome();
    if(!$("allStockView").classList.contains("hidden"))renderAllStock();
  }
  async function showDetail(id){
    const item=await getOne("items",id);if(!item)return;
    selectedItemId=id;
    const rows=[["カテゴリー",categoryName(item.categoryId)],["品名",item.name],["型番",item.model||"—"],["メーカー",item.maker||"—"],["在庫数",`${item.quantity} ${item.unit||"個"}`],["保管場所",item.location||"—"],["備考",item.note||"—"],["最終更新",formatDate(item.updatedAt)]];
    $("detailContent").innerHTML=rows.map(([k,v])=>`<div class="detail-line"><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join("");
    $("detailDialog").showModal();
  }
  async function editSelected(){const item=await getOne("items",selectedItemId);$("detailDialog").close();if(item)openItemDialog(item)}
  async function deleteSelected(){
    const item=await getOne("items",selectedItemId);if(!item)return;
    if(!confirm(`「${item.name}」を削除しますか？`))return;
    await del("items",selectedItemId);$("detailDialog").close();toast("商品を削除しました");
    if(currentCategory)renderCategory();renderHome();if(!$("allStockView").classList.contains("hidden"))renderAllStock();
  }
  async function startStocktake(){
    const items=await categoryItems(currentCategory);
    if(!items.length){toast("棚卸し対象の商品がありません");return}
    stocktake={id:uid(),categoryId:currentCategory,date:now(),items:items.map(i=>({itemId:i.id,name:i.name,model:i.model||"",unit:i.unit||"個",before:Number(i.quantity),actual:""}))};
    $("stocktakeTitle").textContent=categoryName(currentCategory)+"の棚卸し";
    showView("stocktakeView");renderStocktake();
  }
  function renderStocktake(){
    const done=stocktake.items.filter(i=>i.actual!=="").length;
    $("stocktakeSummary").innerHTML=`<span>入力済み <b>${done} / ${stocktake.items.length}</b></span><span>未入力は確定できません</span>`;
    $("stocktakeItems").innerHTML=stocktake.items.map((i,index)=>{
      const diff=i.actual===""?null:Number(i.actual)-i.before;
      return `<div class="stock-row"><div class="stock-row-head"><div><h3>${escapeHtml(i.name)}</h3><div class="sub">${i.model?"型番："+escapeHtml(i.model):"型番未登録"}</div></div></div><div class="stock-input-row"><div class="stock-number"><small>現在の登録在庫</small><strong>${i.before} <small>${escapeHtml(i.unit)}</small></strong></div><div class="stock-entry"><label for="actual-${index}">実棚卸し数量</label><input id="actual-${index}" data-index="${index}" type="number" min="0" step="any" inputmode="decimal" placeholder="数量" value="${escapeHtml(i.actual)}"></div></div><div class="difference">${diff===null?"差異：未入力":`差異：<span class="${diff>0?"diff-plus":diff<0?"diff-minus":""}">${diff>0?"+":""}${diff} ${escapeHtml(i.unit)}</span>`}</div></div>`;
    }).join("");
    $("stocktakeItems").querySelectorAll("[data-index]").forEach(input=>input.addEventListener("input",e=>{
      const idx=Number(e.target.dataset.index);stocktake.items[idx].actual=e.target.value;renderStocktakePreserveFocus(idx,e.target.value);
    }));
  }
  function renderStocktakePreserveFocus(index,value){
    const el=$(`actual-${index}`);const card=el.closest(".stock-row");const diff=value===""?null:Number(value)-stocktake.items[index].before;
    card.querySelector(".difference").innerHTML=diff===null?"差異：未入力":`差異：<span class="${diff>0?"diff-plus":diff<0?"diff-minus":""}">${diff>0?"+":""}${diff} ${escapeHtml(stocktake.items[index].unit)}</span>`;
    const done=stocktake.items.filter(i=>i.actual!=="").length;
    $("stocktakeSummary").innerHTML=`<span>入力済み <b>${done} / ${stocktake.items.length}</b></span><span>未入力は確定できません</span>`;
  }
  async function confirmStocktake(){
    if(!stocktake)return;
    const missing=stocktake.items.filter(i=>i.actual===""||!Number.isFinite(Number(i.actual))||Number(i.actual)<0);
    if(missing.length){toast(`未入力または不正な数量が${missing.length}件あります`);return}
    if(!confirm("入力した数量で在庫を更新し、棚卸しを確定しますか？"))return;
    const record={id:stocktake.id,categoryId:stocktake.categoryId,date:stocktake.date,confirmedAt:now(),items:stocktake.items.map(i=>({...i,actual:Number(i.actual),difference:Number(i.actual)-i.before}))};
    // Persist each item, then write the immutable snapshot history.
    for(const row of record.items){const item=await getOne("items",row.itemId);if(item){item.quantity=row.actual;item.updatedAt=record.confirmedAt;await put("items",item)}}
    await put("history",record);stocktake=null;toast("棚卸しを確定しました");goHome();
  }
  async function renderAllStock(){
    const all=(await getAll("items")).sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.name.localeCompare(b.name,"ja"));
    const q=$("allSearch").value.trim().toLowerCase(),cat=$("allCategoryFilter").value;
    const filtered=all.filter(i=>(!cat||i.categoryId===cat)&&[i.name,i.model,i.maker,i.location].join(" ").toLowerCase().includes(q));
    $("allCount").textContent=`${filtered.length} / ${all.length}商品`;
    $("allItems").innerHTML=filtered.length?filtered.map(i=>`<div class="item-card"><div class="item-top"><span><span class="item-name">${escapeHtml(i.name)}</span><span class="item-meta">${categoryName(i.categoryId)} ・ ${i.model?"型番："+escapeHtml(i.model):"型番未登録"}${i.maker?" ・ "+escapeHtml(i.maker):""}</span></span><span class="item-qty"><strong>${escapeHtml(i.quantity)}</strong><small>${escapeHtml(i.unit||"個")}</small></span></div>${i.location?`<div class="item-tags"><span class="tag">${escapeHtml(i.location)}</span></div>`:""}</div>`).join(""):`<div class="empty">該当する商品がありません。</div>`;
  }
  function csvEscape(v){const s=String(v??"");return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
  async function exportCSV(){
    const items=(await getAll("items")).sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.name.localeCompare(b.name,"ja"));
    const headers=["商品ID","カテゴリー","品名","型番","メーカー","在庫数","単位","保管場所","備考","最終更新日時"];
    const rows=items.map(i=>[i.id,categoryName(i.categoryId),i.name,i.model,i.maker,i.quantity,i.unit,i.location,i.note,i.updatedAt]);
    downloadBlob("\uFEFF"+[headers,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n"),"在庫一覧_"+new Date().toISOString().slice(0,10)+".csv","text/csv;charset=utf-8");
    toast("CSVを書き出しました");
  }
  async function exportBackup(){
    const payload={app:"inventory-local",version:2,exportedAt:now(),categories:CATEGORIES,items:await getAll("items"),history:await getAll("history")};
    downloadBlob(JSON.stringify(payload,null,2),"在庫管理バックアップ_"+new Date().toISOString().slice(0,10)+".json","application/json");
    toast("バックアップを書き出しました");
  }
  function downloadBlob(content,name,type){
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importBackup(file){
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(data.app!=="inventory-local"||!Array.isArray(data.items)||!Array.isArray(data.history))throw new Error("形式が違います");
      const restoredCategories=Array.isArray(data.categories)&&data.categories.length?data.categories:DEFAULT_CATEGORIES;
      if(!confirm(`カテゴリー${restoredCategories.length}件・商品${data.items.length}件・棚卸し履歴${data.history.length}件で現在のデータを上書きします。よろしいですか？`))return;
      await clear("items");await clear("history");await clear("categories");
      for(const c of restoredCategories)await put("categories",c);
      CATEGORIES=restoredCategories;
      for(const item of data.items)await put("items",item);
      for(const row of data.history)await put("history",row);
      refreshCategorySelectors();renderCategorySettings();
      toast("バックアップを復元しました");goHome();
    }catch(e){alert("バックアップを読み込めませんでした。\n"+e.message)}
    $("importBackupInput").value="";
  }
  async function renderHistory(){
    const rows=(await getAll("history")).sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt));
    $("historyList").innerHTML=rows.length?rows.map(h=>{
      const diff=h.items.reduce((n,i)=>n+(i.difference!==0?1:0),0);
      return `<div class="history-card"><b>${categoryName(h.categoryId)}の棚卸し</b><p>${formatDate(h.confirmedAt)} ・ ${h.items.length}商品 ・ 差異あり ${diff}商品</p><p>棚卸しID：${escapeHtml(h.id.slice(0,8))}</p></div>`;
    }).join(""):`<div class="empty">棚卸し履歴はまだありません。</div>`;
  }
  function refreshCategorySelectors(){
    const options=CATEGORIES.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    const old=$("allCategoryFilter").value;
    $("allCategoryFilter").innerHTML='<option value="">すべてのカテゴリー</option>'+options;
    if(CATEGORIES.some(c=>c.id===old))$("allCategoryFilter").value=old;
    const itemOld=$("itemCategory").value;
    $("itemCategory").innerHTML=options;
    if(CATEGORIES.some(c=>c.id===itemOld))$("itemCategory").value=itemOld;
  }
  function renderCategorySettings(){
    $("categorySettingsList").innerHTML=CATEGORIES.map(c=>`<div class="category-setting-row"><span class="cat-icon">${escapeHtml(c.icon)}</span><span class="category-setting-name"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.desc||"")}</small></span><button class="mini-btn" data-edit-category="${escapeHtml(c.id)}">編集</button><button class="mini-btn danger-mini" data-delete-category="${escapeHtml(c.id)}">削除</button></div>`).join("");
    $("categorySettingsList").querySelectorAll("[data-edit-category]").forEach(b=>b.addEventListener("click",()=>openCategoryDialog(CATEGORIES.find(c=>c.id===b.dataset.editCategory))));
    $("categorySettingsList").querySelectorAll("[data-delete-category]").forEach(b=>b.addEventListener("click",()=>deleteCategory(b.dataset.deleteCategory)));
  }
  function openCategoryDialog(category=null){
    $("categoryForm").reset();
    $("categoryEditId").value=category?.id||"";
    $("categoryDialogTitle").textContent=category?"カテゴリー編集":"カテゴリー追加";
    $("categoryNameInput").value=category?.name||"";
    $("categoryDescInput").value=category?.desc||"";
    $("categoryIconInput").innerHTML=ICON_OPTIONS.map(icon=>`<option value="${icon}">${icon}</option>`).join("");
    $("categoryIconInput").value=category?.icon||"📦";
    $("categoryIconPreview").textContent=$("categoryIconInput").value;
    $("categoryDialog").showModal();
  }
  async function saveCategory(e){
    e.preventDefault();
    const id=$("categoryEditId").value||uid();
    const old=CATEGORIES.find(c=>c.id===id);
    const name=$("categoryNameInput").value.trim();
    if(!name){toast("カテゴリー名を入力してください");return}
    if(CATEGORIES.some(c=>c.id!==id&&c.name===name)){toast("同じ名前のカテゴリーがあります");return}
    const category={id,name,desc:$("categoryDescInput").value.trim(),icon:$("categoryIconInput").value,order:old?.order??CATEGORIES.length};
    await put("categories",category);
    if(old)CATEGORIES=CATEGORIES.map(c=>c.id===id?category:c);else CATEGORIES.push(category);
    $("categoryDialog").close();refreshCategorySelectors();renderCategorySettings();renderHome();
    if(currentCategory===id)openCategory(id);
    toast(old?"カテゴリーを更新しました":"カテゴリーを追加しました");
  }
  async function deleteCategory(id){
    const category=CATEGORIES.find(c=>c.id===id);if(!category)return;
    const items=(await getAll("items")).filter(i=>i.categoryId===id);
    if(items.length){alert(`このカテゴリーには${items.length}件の商品があります。先に商品を別カテゴリーへ移動してください。`);return}
    const history=(await getAll("history")).filter(h=>h.categoryId===id);
    if(history.length){alert(`このカテゴリーには棚卸し履歴が${history.length}件あります。履歴を正しく残すため削除できません。名称やアイコンの変更は可能です。`);return}
    if(!confirm(`「${category.name}」を削除しますか？`))return;
    await del("categories",id);CATEGORIES=CATEGORIES.filter(c=>c.id!==id);
    refreshCategorySelectors();renderCategorySettings();renderHome();
    if(currentCategory===id)goHome();
    toast("カテゴリーを削除しました");
  }

  function setup(){
    $("homeBtn").addEventListener("click",goHome);
    document.querySelectorAll("[data-back]").forEach(b=>b.addEventListener("click",()=>{if(stocktake){if(confirm("棚卸しを中止して戻りますか？")){stocktake=null;openCategory(currentCategory)}}else goHome()}));
    $("allStockBtn").addEventListener("click",()=>{showView("allStockView");renderAllStock()});
    $("historyBtn").addEventListener("click",()=>{showView("historyView");renderHistory()});
    $("settingsBtn").addEventListener("click",()=>{showView("settingsView");renderCategorySettings()});
    $("addCategoryBtn").addEventListener("click",()=>openCategoryDialog());
    $("closeCategoryDialog").addEventListener("click",()=>$("categoryDialog").close());
    $("categoryForm").addEventListener("submit",saveCategory);
    $("categoryIconInput").addEventListener("change",()=>$("categoryIconPreview").textContent=$("categoryIconInput").value);
    $("addItemBtn").addEventListener("click",()=>openItemDialog());
    $("closeItemDialog").addEventListener("click",()=>$("itemDialog").close());
    $("itemForm").addEventListener("submit",saveItem);
    $("closeDetailDialog").addEventListener("click",()=>$("detailDialog").close());
    $("detailEditBtn").addEventListener("click",editSelected);$("detailDeleteBtn").addEventListener("click",deleteSelected);
    $("categorySearch").addEventListener("input",renderCategory);
    $("startStocktakeBtn").addEventListener("click",startStocktake);
    $("confirmStocktakeBtn").addEventListener("click",confirmStocktake);
    $("cancelStocktakeBtn").addEventListener("click",()=>{if(confirm("入力中の棚卸しを破棄しますか？")){stocktake=null;openCategory(currentCategory)}});
    $("allSearch").addEventListener("input",renderAllStock);$("allCategoryFilter").addEventListener("change",renderAllStock);
    refreshCategorySelectors();
    $("csvBtn").addEventListener("click",exportCSV);$("settingsCsvBtn").addEventListener("click",exportCSV);
    $("backupBtn").addEventListener("click",exportBackup);$("exportBackupBtn").addEventListener("click",exportBackup);
    $("importBackupInput").addEventListener("change",e=>importBackup(e.target.files[0]));
  }
  async function init(){
    // ログイン画面の段階でもService Workerを更新し、古い認証コードの残留を防ぐ。
    if("serviceWorker" in navigator && location.protocol!=="file:"){
      navigator.serviceWorker.register("./sw.js").catch(e=>console.warn("Service Worker registration failed",e));
    }
    try{
      if(!window.FIREBASE_CONFIG||String(window.FIREBASE_CONFIG.apiKey).startsWith("ここに"))throw new Error("firebase-config.js のFirebase設定が未入力です。");
      if(!firebase.apps.length)firebase.initializeApp(window.FIREBASE_CONFIG);
      const auth=firebase.auth();
      $("googleLoginBtn").addEventListener("click",startGoogleLogin);
      $("pinLoginBtn").addEventListener("click",verifyPin);
      $("pinInput").addEventListener("keydown",e=>{if(e.key==="Enter")verifyPin()});
      $("switchUserBtn").addEventListener("click",()=>{
        sessionStorage.removeItem("inventoryUser");currentUser=null;
        if(auth.currentUser)showPinPanel();else showLogin();
      });

      // iOS Chrome/Safariでは認証状態の復元に時間がかかる場合があるため、
      // getRedirectResultの完了前に未ログイン画面へ戻さない。
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      let redirectResult=null;
      let redirectError=null;
      try{redirectResult=await auth.getRedirectResult()}catch(e){redirectError=e;console.error("Redirect result error",e)}

      const authenticatedUser=(redirectResult&&redirectResult.user)||auth.currentUser;
      if(authenticatedUser){
        const saved=sessionStorage.getItem("inventoryUser");
        if(saved){
          try{currentUser=JSON.parse(saved);await enterApp()}
          catch(e){console.error("Saved user restore failed",e);sessionStorage.removeItem("inventoryUser");showPinPanel()}
        }else{showPinPanel()}
      }else{
        showLogin(redirectError?"Google認証を完了できませんでした："+authErrorMessage(redirectError):"");
      }

      // 初回の認証状態確定後も監視し、復帰・ログアウトを画面へ反映する。
      auth.onAuthStateChanged(async user=>{
        if(user){
          if(appStarted)return;
          const saved=sessionStorage.getItem("inventoryUser");
          if(saved){
            try{currentUser=JSON.parse(saved);await enterApp()}
            catch(e){console.error("App restore failed",e);sessionStorage.removeItem("inventoryUser");showPinPanel()}
          }else{showPinPanel()}
        }else{
          appStarted=false;currentUser=null;sessionStorage.removeItem("inventoryUser");showLogin();
        }
      },error=>{
        console.error("Auth state observer error",error);
        showLogin("ログイン状態を確認できませんでした："+authErrorMessage(error));
      });
    }catch(e){showLogin(e.message);console.error(e)}
  }
  init();
})();