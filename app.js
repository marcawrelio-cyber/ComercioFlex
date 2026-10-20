
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const client=window.supabase.createClient(CF_CONFIG.url,CF_CONFIG.key,{auth:{detectSessionInUrl:false}});
const wait=(promise,ms=12000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de conexão esgotado. Verifique a internet e tente novamente.')),ms))]);
let user=null,company=null,companies=[],products=[],sales=[],clients=[],suppliers=[],finances=[],myRole=null,registers=[],shifts=[],members=[],audit=[],stockMoves=[],saleItems=[];
function message(t,bad=false){$('status').textContent=t;$('status').className=bad?'error':'good'}
function err(e){alert('Erro: '+(e?.message||e))}
async function query(table){let {data,error}=await client.from(table).select('*').eq('empresa_id',company.id);if(error)throw error;return data||[]}
async function init(){try{let {data,error}=await wait(client.auth.getSession());if(error&&!error.message?.includes('session'))console.log(error.message);user=data?.session?.user||null;await loadCompanies()}catch(e){message(e.message,true)}}
async function loadCompanies(){ $('loginBox').classList.toggle('hide',!!user);$('loggedBox').classList.toggle('hide',!user);if(!user){company=null;$('work').classList.add('hide');$('companyLabel').textContent='Sem empresa';message('Entre ou crie sua conta.');return}
message('Conectado: '+user.email);
const {data,error}=await wait(client.from('cf_empresas').select('id,nome,ramo,tema,owner_id'));if(error)throw error;companies=data||[];
const select=$('companies');let previous=company?.id||sessionStorage.getItem('cf_active');select.replaceChildren();
companies.forEach(c=>{let o=document.createElement('option');o.value=c.id;o.textContent=c.nome+' — '+c.ramo;select.append(o)});
company=companies.find(c=>c.id===previous)||companies[0]||null;if(company){select.value=company.id;sessionStorage.setItem('cf_active',company.id);await refresh()}else{$('work').classList.add('hide');$('companyLabel').textContent='Crie uma empresa'}
}
async function refresh(){if(!company)return;$('work').classList.remove('hide');$('companyLabel').textContent=company.nome;$('hello').textContent='Bem-vindo à '+company.nome;$('companyInfo').textContent=company.nome+' • '+company.ramo;
try{[products,sales,clients,suppliers,finances]=await Promise.all(['cf_produtos','cf_vendas','cf_clientes','cf_fornecedores','cf_financeiro'].map(query));await loadOperations();draw();drawOperations()}catch(e){err(e)}}
function line(target,title,description){let r=document.createElement('div');r.className='line';let a=document.createElement('strong'),b=document.createElement('span');a.textContent=title;b.textContent=description;r.append(a,b);$(target).append(r)}
function clear(id){$(id).replaceChildren()}
function draw(){
$('metricProducts').textContent=products.length;$('metricStock').textContent=products.reduce((a,x)=>a+Number(x.estoque),0);$('metricSales').textContent=fmt(sales.filter(s=>s.status==='concluida').reduce((a,x)=>a+Number(x.total),0));$('metricClients').textContent=clients.length;
['productsList','salesList','clientsList','suppliersList','financeList','saleProduct','stockProduct'].forEach(clear);
products.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).forEach(x=>{if(x.nome.toLocaleLowerCase('pt-BR').includes($('productSearch').value.toLocaleLowerCase('pt-BR'))){line('productsList',x.nome,fmt(x.preco)+' • Estoque: '+x.estoque);if(roleCan('gestao'))actionButton('productsList','Editar',()=>editProduct(x))}if(x.estoque>0){let o=document.createElement('option');o.value=x.id;o.textContent=x.nome+' — '+fmt(x.preco)+' ('+x.estoque+')';$('saleProduct').append(o)}let s=document.createElement('option');s.value=x.id;s.textContent=x.nome+' — '+x.estoque+' unidades';$('stockProduct').append(s)});
sales.sort((a,b)=>b.criada_em.localeCompare(a.criada_em)).slice(0,30).forEach(x=>{line('salesList',fmt(x.total),new Date(x.criada_em).toLocaleString('pt-BR'));actionButton('salesList','Detalhes',()=>saleDetails(x))});
clients.filter(x=>(x.nome+' '+(x.whatsapp||'')).toLocaleLowerCase('pt-BR').includes($('clientSearch').value.toLocaleLowerCase('pt-BR'))).forEach(x=>{line('clientsList',x.nome,x.whatsapp||'Sem contato');if(roleCan('gestao'))actionButton('clientsList','Editar',()=>editClient(x))});
suppliers.forEach(x=>line('suppliersList',x.nome,x.contato||'Sem contato'));
finances.sort((a,b)=>String(b.id).localeCompare(String(a.id))).forEach(x=>line('financeList',x.descricao,(x.tipo==='entrada'?'+ ':'− ')+fmt(x.valor)+' • '+(x.pago?'Pago':'Pendente')));
const ins=finances.filter(x=>x.pago&&x.tipo==='entrada').reduce((a,x)=>a+Number(x.valor),0),outs=finances.filter(x=>x.pago&&x.tipo==='saida').reduce((a,x)=>a+Number(x.valor),0),pending=finances.filter(x=>!x.pago).reduce((a,x)=>a+Number(x.valor),0);$('totalIn').textContent=fmt(ins);$('totalOut').textContent=fmt(outs);$('totalBalance').textContent=fmt(ins-outs);$('totalPending').textContent=fmt(pending);loadGallery(company.id);
}
async function insert(table,obj,form){try{if(!company)throw Error('Selecione uma empresa');const {error}=await client.from(table).insert({...obj,empresa_id:company.id});if(error)throw error;form.reset();await refresh();alert('Salvo na nuvem!')}catch(e){err(e)}}
function actionButton(target,title,fn){let b=document.createElement('button');b.className='alt';b.style.margin='3px 0 12px';b.style.fontSize='13px';b.textContent=title;b.onclick=fn;$(target).append(b)}
function editOpen(title,fields,save){$('editTitle').textContent=title;$('editFields').replaceChildren();for(const f of fields){let l=document.createElement('label');l.textContent=f.label;let input=document.createElement('input');input.name=f.name;input.type=f.type||'text';if(f.type==='number'){input.min='0';input.step='.01'}input.value=f.value??'';input.required=true;l.append(input);$('editFields').append(l)}$('editOverlay').classList.remove('hide');$('editForm').onsubmit=async e=>{e.preventDefault();let data=Object.fromEntries(new FormData(e.target));try{await save(data);$('editOverlay').classList.add('hide');await refresh();alert('Alterações salvas na nuvem!')}catch(ex){err(ex)}}}
$('editCancel').onclick=()=>$('editOverlay').classList.add('hide');
async function updateRecord(table,id,changes){const {data,error}=await client.from(table).update(changes).eq('id',id).eq('empresa_id',company.id).select('id');if(error)throw error;if(!data?.length)throw Error('Registro não atualizado. Verifique permissões.')}
function editProduct(x){editOpen('Editar produto',[{name:'nome',label:'Nome',value:x.nome},{name:'preco',label:'Preço de venda',type:'number',value:x.preco},{name:'custo',label:'Custo',type:'number',value:x.custo}],async d=>updateRecord('cf_produtos',x.id,{nome:d.nome.trim(),preco:Number(d.preco),custo:Number(d.custo)}))}
function editClient(x){editOpen('Editar cliente',[{name:'nome',label:'Nome',value:x.nome},{name:'whatsapp',label:'WhatsApp',value:x.whatsapp||''}],async d=>updateRecord('cf_clientes',x.id,{nome:d.nome.trim(),whatsapp:d.whatsapp.trim()}))}
async function saleDetails(x){try{const {data,error}=await client.from('cf_venda_itens').select('produto_id,quantidade,preco_unitario').eq('empresa_id',company.id).eq('venda_id',x.id);if(error)throw error;const names=new Map(products.map(p=>[p.id,p.nome]));let items=(data||[]).map(i=>(names.get(i.produto_id)||'Produto')+' — '+i.quantidade+' × '+fmt(i.preco_unitario)).join('\n');alert('Venda de '+new Date(x.criada_em).toLocaleString('pt-BR')+'\n'+(items||'Sem itens encontrados')+'\nTotal: '+fmt(x.total))}catch(e){err(e)}}
$('productSearch').oninput=draw;$('clientSearch').oninput=draw;
function bindForm(id,table,get){$(id).addEventListener('submit',async e=>{e.preventDefault();await insert(table,get(),e.target)})}
bindForm('productForm','cf_produtos',()=>({nome:$('pName').value.trim(),preco:Number($('pPrice').value),custo:Number($('pCost').value||0),estoque:Number($('pStock').value)}));
bindForm('clientForm','cf_clientes',()=>({nome:$('cName').value.trim(),whatsapp:$('cPhone').value.trim()}));
bindForm('supplierForm','cf_fornecedores',()=>({nome:$('sName').value.trim(),contato:$('sContact').value.trim()}));
bindForm('financeForm','cf_financeiro',()=>({descricao:$('fDescription').value.trim(),tipo:$('fType').value,valor:Number($('fValue').value),vencimento:$('fDate').value||null,pago:$('fPaid').checked}));
$('saleForm').addEventListener('submit',async e=>{e.preventDefault();try{let qty=Number($('saleQty').value);if(!Number.isInteger(qty)||qty<1)throw Error('Quantidade inválida');let {error}=await client.rpc('cf7_vender',{p_empresa:company.id,p_produto:$('saleProduct').value,p_quantidade:qty,p_turno:$('saleShift').value});if(error)throw error;await refresh();alert('Venda registrada na nuvem e estoque atualizado!')}catch(ex){err(ex)}});
$('loginBtn').onclick=async()=>{try{let {data,error}=await wait(client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));if(error)throw error;user=data.user;message('Autenticado. Carregando empresas...');await loadCompanies()}catch(e){err(e)}};
$('signupBtn').onclick=async()=>{try{let {data,error}=await wait(client.auth.signUp({email:$('email').value.trim(),password:$('password').value}));if(error)throw error;user=data.user;message('Autenticado. Carregando empresas...');await loadCompanies();if(!user)alert('Confirme o cadastro pelo e-mail antes de entrar.')}catch(e){err(e)}};
$('logoutBtn').onclick=async()=>{await client.auth.signOut();user=null;company=null;await loadCompanies()};
$('createCompany').onclick=async()=>{try{let nome=$('newCompany').value.trim();if(!nome)throw Error('Digite o nome');let {error}=await client.from('cf_empresas').insert({nome,ramo:$('newBranch').value,owner_id:user.id});if(error)throw error;$('newCompany').value='';await loadCompanies();alert('Empresa criada na nuvem!')}catch(e){err(e)}};
$('companies').onchange=async()=>{company=companies.find(x=>x.id===$('companies').value);sessionStorage.setItem('cf_active',company.id);await refresh()};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#work section').forEach(s=>s.classList.toggle('hide',s.id!==b.dataset.page));document.querySelectorAll('nav button').forEach(x=>x.className=x===b?'':'alt')});

// Galeria privada na nuvem, com seleção e transparência por empresa.
// O bucket não é público: a leitura das fotos usa URLs temporárias.
const BUCKET='cf-fotos';
let galleryRender=0, galleryUrls=[],cloudPhotoUrl=null, visualSettings=null, visualSaveTimer=null;
const safeName=name=>(name||'foto').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-70);
function applyTransparency(value){
 value=Math.max(0,Math.min(100,Number(value??65)));
 document.body.style.setProperty('--card-alpha',String((100-value)/100));
 $('cardTransparency').value=String(value);$('transparencyValue').textContent=value+'%';
}
async function getVisualSettings(companyId){
 const {data,error}=await client.from('cf_visual_config').select('transparencia,foto_ativa').eq('empresa_id',companyId).maybeSingle();
 if(error)throw error;return data||{transparencia:65,foto_ativa:null};
}
async function saveVisualSettings(companyId,changes){
 const {error}=await client.from('cf_visual_config').upsert({empresa_id:companyId,...changes},{onConflict:'empresa_id'});
 if(error)throw error;
}
$('cardTransparency').addEventListener('input',e=>{
 if(!company)return;const id=company.id,v=Number(e.target.value);
 applyTransparency(v);localStorage.setItem('cf_transparency_'+id,String(v));
 clearTimeout(visualSaveTimer);
 visualSaveTimer=setTimeout(async()=>{
  try{await saveVisualSettings(id,{transparencia:v,foto_ativa:visualSettings?.foto_ativa||null})}
  catch(ex){$('galleryStatus').textContent='Não foi possível salvar a transparência na nuvem: '+ex.message}
 },500);
});
$('resetTransparency').onclick=()=>{$('cardTransparency').value='65';$('cardTransparency').dispatchEvent(new Event('input'))};
async function listCloudPhotos(id){
 const {data,error}=await client.from('cf_fotos').select('id,nome,caminho,criada_em').eq('empresa_id',id).order('criada_em',{ascending:false});
 if(error)throw error;return data||[];
}
async function showCloudBackground(path){
 if(!path){document.body.style.setProperty('--photo','linear-gradient(130deg,#12344c,#14283e)');return}
 const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,3600);
 if(error)throw error;
 document.body.style.setProperty('--photo',`url("${data.signedUrl}")`);
}
async function loadGallery(id){
 const token=++galleryRender, target=$('photoGallery'),status=$('galleryStatus');
 target.replaceChildren();status.textContent='Carregando galeria na nuvem...';
 try{
  const [settings,photos]=await Promise.all([getVisualSettings(id),listCloudPhotos(id)]);
  if(token!==galleryRender||!company||company.id!==id)return;
  visualSettings=settings;applyTransparency(settings.transparencia);
  await showCloudBackground(photos.find(x=>x.id===settings.foto_ativa)?.caminho||null);
  status.textContent=photos.length+' foto(s) na nuvem.';
  for(const photo of photos){
   const card=document.createElement('div');card.className='gallery-item'+(settings.foto_ativa===photo.id?' active':'');
   const preview=document.createElement('img');preview.alt=photo.nome;preview.loading='lazy';
   client.storage.from(BUCKET).createSignedUrl(photo.caminho,3600).then(({data,error})=>{if(!error&&token===galleryRender)preview.src=data.signedUrl});
   const label=document.createElement('span');label.className='photo-name';label.textContent=photo.nome;
   const choose=document.createElement('button');choose.textContent=settings.foto_ativa===photo.id?'Em uso':'Usar como fundo';
   choose.onclick=async()=>{try{await saveVisualSettings(id,{transparencia:Number($('cardTransparency').value),foto_ativa:photo.id});await loadGallery(id)}catch(e){alert('Erro: '+e.message)}};
   const remove=document.createElement('button');remove.className='gallery-delete';remove.textContent='Excluir foto';
   remove.onclick=async()=>{
    if(!confirm('Excluir esta foto da nuvem?'))return;
    try{
     if(visualSettings?.foto_ativa===photo.id)await saveVisualSettings(id,{transparencia:Number($('cardTransparency').value),foto_ativa:null});
     const {error:storageError}=await client.storage.from(BUCKET).remove([photo.caminho]);if(storageError)throw storageError;
     const {error}=await client.from('cf_fotos').delete().eq('id',photo.id).eq('empresa_id',id);if(error)throw error;
     await loadGallery(id);
    }catch(e){alert('Erro ao excluir: '+e.message)}
   };
   card.append(preview,label,choose,remove);target.append(card);
  }
 }catch(e){status.textContent='Não foi possível acessar a galeria na nuvem. Execute o SQL da Etapa 6: '+e.message}
}
async function uploadCloudPhoto(id,file){
 if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use JPG, PNG ou WebP até 2 MB');
 const path=id+'/'+crypto.randomUUID()+'-'+safeName(file.name);
 const {error:upError}=await client.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(upError)throw upError;
 const {data,error}=await client.from('cf_fotos').insert({empresa_id:id,nome:file.name,caminho:path}).select('id').single();
 if(error){await client.storage.from(BUCKET).remove([path]);throw error}
 return data.id;
}
$('photo').onchange=async e=>{
 const f=e.target.files[0];if(!f||!company)return;
 const id=company.id;const status=$('galleryStatus');status.textContent='Enviando foto para a nuvem...';
 try{const photoId=await uploadCloudPhoto(id,f);await saveVisualSettings(id,{transparencia:Number($('cardTransparency').value),foto_ativa:photoId});await loadGallery(id)}
 catch(ex){status.textContent='Falha ao enviar: '+ex.message}finally{e.target.value=''}
};
$('removePhoto').onclick=async()=>{
 if(!company)return;
 try{await saveVisualSettings(company.id,{transparencia:Number($('cardTransparency').value),foto_ativa:null});await loadGallery(company.id)}
 catch(e){alert('Erro: '+e.message)}
};
// Migração manual e segura das fotos da Etapa 5 armazenadas no IndexedDB.
$('importLocal').onclick=async()=>{
 if(!company)return;const id=company.id,status=$('galleryStatus');
 try{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('ComercioFlexGaleria',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  const photos=await new Promise((resolve,reject)=>{const req=db.transaction('fotos','readonly').objectStore('fotos').index('empresa').getAll(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  if(!photos.length){status.textContent='Não há fotos antigas neste navegador para importar.';return}
  if(!confirm('Importar '+photos.length+' foto(s) antigas para a nuvem? Elas continuarão guardadas neste navegador.'))return;
  let count=0,failures=[];status.textContent='Importando fotos...';
  for(const item of photos){try{await uploadCloudPhoto(id,new File([item.blob],item.nome,{type:item.blob.type}));count++}catch(e){failures.push(item.nome+': '+e.message)}}
  await loadGallery(id);status.textContent=count+' foto(s) importadas. '+(failures.length?'Falhas: '+failures.join('; '):'As fotos antigas continuam no navegador.');
 }catch(e){status.textContent='Falha na importação: '+e.message}
};

// ETAPA 7 — Operacao multiusuario com verificacao de permissoes no Supabase.
const roleCan=(action)=>{
 const roles={admin:['proprietario'],gestao:['proprietario','administrador','gerente'],
 vender:['proprietario','administrador','gerente','caixa','funcionario'],
 estoque:['proprietario','administrador','gerente','estoquista']};
 return (roles[action]||[]).includes(myRole);
};
async function loadOperations(){
 const id=company.id;
 const {data:r,error:re}=await client.rpc('cf7_papel',{p_empresa:id});if(re)throw re;
 myRole=r;
 const reads=await Promise.all(['cf7_caixas','cf7_turnos','cf_membros','cf7_venda_auditoria','cf7_estoque_movimentos','cf_venda_itens'].map(t=>client.from(t).select('*').eq('empresa_id',id)));
 for(const response of reads)if(response.error)throw response.error;
 [registers,shifts,members,audit,stockMoves,saleItems]=reads.map(x=>x.data||[]);
}
function makeOption(value,text){let o=document.createElement('option');o.value=value;o.textContent=text;return o}
function drawOperations(){
 // A interface reduz acessos; a autorizacao real esta no banco (RLS e RPC).
 const access={equipe:myRole==='proprietario',caixas:roleCan('vender')||roleCan('gestao'),relatorios:roleCan('gestao'),
 produtos:roleCan('estoque')||roleCan('vender'),vendas:roleCan('vender'),clientes:roleCan('gestao'),
 fornecedores:roleCan('gestao'),financeiro:roleCan('gestao'),visual:roleCan('gestao')};
 document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('hide',access[b.dataset.page]===false)});
 ['productForm','stockForm'].forEach(id=>$(id).classList.toggle('hide',id==='productForm'?!roleCan('gestao'):!roleCan('estoque')));
 ['clientForm','supplierForm','financeForm'].forEach(id=>$(id).classList.toggle('hide',!roleCan('gestao')));
 $('newRegisterForm').classList.toggle('hide',!roleCan('gestao'));
 $('teamForm').classList.toggle('hide',myRole!=='proprietario');
 $('registerList').replaceChildren();registers.forEach(x=>line('registerList',x.nome,x.ativo?'Ativo':'Inativo'));
 $('shiftRegister').replaceChildren();$('saleShift').replaceChildren();
 const open=shifts.filter(x=>!x.fechado_em);
 registers.filter(x=>x.ativo).forEach(x=>{
  $('shiftRegister').append(makeOption(x.id,x.nome));
 });
 open.filter(x=>x.operador_id===user.id||roleCan('gestao')).forEach(x=>{
  const name=registers.find(c=>c.id===x.caixa_id)?.nome||'Caixa';
  $('saleShift').append(makeOption(x.id,name+' · '+new Date(x.aberto_em).toLocaleString('pt-BR')));
 });
 $('shiftList').replaceChildren();
 shifts.slice().sort((a,b)=>b.aberto_em.localeCompare(a.aberto_em)).slice(0,30).forEach(x=>{
  const name=registers.find(c=>c.id===x.caixa_id)?.nome||'Caixa';
  line('shiftList',name+' · '+(x.fechado_em?'Fechado':'Aberto'),new Date(x.aberto_em).toLocaleString('pt-BR')+' · Inicial '+fmt(x.saldo_inicial));
  if(!x.fechado_em&&(x.operador_id===user.id||roleCan('gestao'))){
   actionButton('shiftList','Fechar caixa',async()=>{
    const value=prompt('Saldo final contado em reais (ex.: 150.00)');if(value===null)return;
    const saldo=Number(value.replace(',','.'));if(!Number.isFinite(saldo)||saldo<0)return alert('Valor invalido');
    try{const {error}=await client.rpc('cf7_fechar_turno',{p_turno:x.id,p_saldo:saldo});if(error)throw error;await refresh()}catch(e){err(e)}
   });
  }
 });
 $('teamList').replaceChildren();members.forEach(x=>{
  line('teamList',x.nome_exibicao||'Funcionário',x.papel+' · '+x.usuario_id.slice(0,8)+'…');
  if(myRole==='proprietario')actionButton('teamList','Desvincular',async()=>{
   if(!confirm('Remover acesso deste funcionario?'))return;
   const {error}=await client.from('cf_membros').delete().eq('empresa_id',company.id).eq('usuario_id',x.usuario_id);
   if(error)err(error);else await refresh();
  });
 });
 drawReports();
}
$('teamForm').onsubmit=async e=>{
 e.preventDefault();try{
  const {data,error}=await client.rpc('cf7_convidar',{p_empresa:company.id,p_email:$('teamEmail').value.trim(),p_papel:$('teamRole').value,p_nome:$('teamName').value.trim()});
  if(error)throw error;alert(data);await refresh();
 }catch(e){err(e)}
};
$('newRegisterForm').onsubmit=async e=>{
 e.preventDefault();try{const {error}=await client.from('cf7_caixas').insert({empresa_id:company.id,nome:$('registerName').value.trim()});if(error)throw error;e.target.reset();await refresh()}catch(e){err(e)}
};
$('openShiftForm').onsubmit=async e=>{
 e.preventDefault();try{const {error}=await client.rpc('cf7_abrir_turno',{p_empresa:company.id,p_caixa:$('shiftRegister').value,p_saldo:Number($('shiftOpening').value)});if(error)throw error;await refresh();alert('Caixa aberto!')}catch(e){err(e)}
};
$('stockForm').onsubmit=async e=>{
 e.preventDefault();try{
  const delta=Number($('stockDelta').value);if(!Number.isInteger(delta)||!delta)throw Error('Informe quantidade inteira diferente de zero');
  const {error}=await client.rpc('cf7_ajustar_estoque',{p_empresa:company.id,p_produto:$('stockProduct').value,p_delta:delta,p_motivo:$('stockReason').value.trim()});
  if(error)throw error;e.target.reset();await refresh();alert('Estoque atualizado!');
 }catch(e){err(e)}
};
function reportSales(){
 const start=$('reportStart').value,end=$('reportEnd').value;
 return sales.filter(s=>s.status==='concluida'&&(!start||s.criada_em.slice(0,10)>=start)&&(!end||s.criada_em.slice(0,10)<=end));
}
function drawReports(){
 const filtered=reportSales(),ids=new Set(filtered.map(s=>s.id));
 const total=filtered.reduce((sum,s)=>sum+Number(s.total),0);
 $('reportTotal').textContent=fmt(total);$('reportCount').textContent=filtered.length;
 $('reportAverage').textContent=fmt(filtered.length?total/filtered.length:0);
 $('reportOperators').replaceChildren();$('reportProducts').replaceChildren();$('stockHistory').replaceChildren();
 const byOperator=new Map();audit.filter(a=>ids.has(a.venda_id)).forEach(a=>{
  const sale=filtered.find(s=>s.id===a.venda_id),old=byOperator.get(a.operador_id)||{count:0,total:0};
  old.count++;old.total+=Number(sale?.total||0);byOperator.set(a.operador_id,old);
 });
 for(const [operator,x] of byOperator)line('reportOperators',members.find(m=>m.usuario_id===operator)?.nome_exibicao||'Proprietário / usuário '+operator.slice(0,8),x.count+' vendas · '+fmt(x.total));
 const byProduct=new Map();saleItems.filter(i=>ids.has(i.venda_id)).forEach(i=>byProduct.set(i.produto_id,(byProduct.get(i.produto_id)||0)+i.quantidade));
 [...byProduct].sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([id,qty])=>line('reportProducts',products.find(p=>p.id===id)?.nome||'Produto removido',qty+' unidades'));
 stockMoves.slice().sort((a,b)=>b.criado_em.localeCompare(a.criado_em)).slice(0,30).forEach(m=>line('stockHistory',products.find(p=>p.id===m.produto_id)?.nome||'Produto',m.quantidade+' un. · '+m.motivo+' · '+new Date(m.criado_em).toLocaleDateString('pt-BR')));
}
$('reportFilter').onclick=drawReports;
$('reportCsv').onclick=()=>{
 const rows=[['Data','Venda','Valor','Operador','Caixa'],...reportSales().map(s=>{
  const a=audit.find(x=>x.venda_id===s.id);return [s.criada_em,s.id,s.total,a?.operador_id||'Legado',a?.turno_id||'Sem registro'];
 })];
 const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='comercioflex-vendas.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
};

if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
init();
