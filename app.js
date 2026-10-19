const KEY='comercioflex_v1';
const fresh=()=>({company:{name:'Minha empresa',type:'Roupas',image:''},products:[],sales:[],clients:[]});
let db;try{db=JSON.parse(localStorage.getItem(KEY))||fresh();if(!db.company||!Array.isArray(db.products)||!Array.isArray(db.sales)||!Array.isArray(db.clients))throw Error()}catch(e){db=fresh()}
const $=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));render();return true}catch(e){alert('Sem espaço para salvar. Tente uma foto menor ou exporte um backup.');return false}};
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2600)}
function show(id){document.querySelectorAll('main section').forEach(x=>x.classList.toggle('hide',x.id!==id));render();window.scrollTo(0,0)}
function el(tag,txt){let x=document.createElement(tag);x.textContent=txt;return x}
function row(parent,title,detail,onDelete){let r=el('div','');r.className='line';let info=el('div','');info.append(el('strong',title),el('div',detail));r.append(info);if(onDelete){let b=el('button','Excluir');b.className='danger';b.onclick=onDelete;r.append(b)}parent.append(r)}
function render(){
 $('shopTitle').textContent=db.company.name;$('welcome').textContent='Bem-vindo à '+db.company.name;
 document.body.style.setProperty('--bgimg',db.company.image?`url("${db.company.image}")`:'linear-gradient(125deg,#133a56,#132335)');
 $('nProducts').textContent=db.products.length;$('nStock').textContent=db.products.reduce((a,p)=>a+Number(p.qty),0);$('nSales').textContent=money(db.sales.reduce((a,s)=>a+s.total,0));$('nClients').textContent=db.clients.length;
 $('businessName').value=db.company.name;$('businessType').value=db.company.type;
 $('productsList').replaceChildren();db.products.forEach(p=>row($('productsList'),p.name,`${money(p.price)} • Estoque: ${p.qty}`,()=>{if(confirm('Excluir este produto?')){db.products=db.products.filter(x=>x.id!==p.id);save()}}));
 $('saleProduct').replaceChildren();db.products.filter(p=>p.qty>0).forEach(p=>{let o=el('option',`${p.name} — ${money(p.price)} (${p.qty} disponíveis)`);o.value=p.id;$('saleProduct').append(o)});
 $('salesList').replaceChildren();[...db.sales].reverse().slice(0,30).forEach(s=>row($('salesList'),s.name,`${s.qty} un. • ${money(s.total)} • ${new Date(s.date).toLocaleString('pt-BR')}`));
 $('clientsList').replaceChildren();db.clients.forEach(c=>row($('clientsList'),c.name,c.phone||'Sem WhatsApp',()=>{if(confirm('Excluir cliente?')){db.clients=db.clients.filter(x=>x.id!==c.id);save()}}));
}
$('productForm').onsubmit=e=>{e.preventDefault();db.products.push({id:crypto.randomUUID(),name:$('pName').value.trim(),price:Number($('pPrice').value),qty:Number($('pQty').value)});if(save()){$('productForm').reset();toast('Produto cadastrado')}};
$('saleForm').onsubmit=e=>{e.preventDefault();let p=db.products.find(x=>x.id===$('saleProduct').value),qty=Number($('saleQty').value);if(!p||!Number.isInteger(qty)||qty<1||qty>p.qty)return alert('Quantidade indisponível');p.qty-=qty;db.sales.push({id:crypto.randomUUID(),name:p.name,qty,total:qty*p.price,date:new Date().toISOString()});if(save())toast('Venda registrada')};
$('clientForm').onsubmit=e=>{e.preventDefault();db.clients.push({id:crypto.randomUUID(),name:$('cName').value.trim(),phone:$('cPhone').value.trim()});if(save()){$('clientForm').reset();toast('Cliente salvo')}};
let pendingImage=null;
$('backgroundFile').onchange=e=>{let f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type)){alert('Use JPG, PNG ou WebP de até 2 MB');e.target.value='';return}let reader=new FileReader();reader.onload=()=>{pendingImage=reader.result;$('imageStatus').textContent='Foto selecionada: '+f.name};reader.readAsDataURL(f)};
$('configForm').onsubmit=e=>{e.preventDefault();db.company.name=$('businessName').value.trim();db.company.type=$('businessType').value;if(pendingImage!==null)db.company.image=pendingImage;if(save()){pendingImage=null;toast('Empresa atualizada')}};
function clearImage(){pendingImage='';db.company.image='';if(save())toast('Foto removida')}
function exportBackup(){let a=document.createElement('a'),blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='ComercioFlex-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
$('importFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let d=JSON.parse(await f.text());if(!d.company||!Array.isArray(d.products)||!Array.isArray(d.sales)||!Array.isArray(d.clients))throw Error();if(confirm('Substituir todos os dados atuais pelo backup?')){db=d;save();toast('Backup restaurado')}}catch(err){alert('Arquivo de backup inválido')}e.target.value=''};
render();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
