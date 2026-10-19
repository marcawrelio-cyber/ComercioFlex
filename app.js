
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const client=window.supabase.createClient(CF_CONFIG.url,CF_CONFIG.key,{auth:{detectSessionInUrl:false}});
const wait=(promise,ms=12000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de conexão esgotado. Verifique a internet e tente novamente.')),ms))]);
let user=null,company=null,companies=[],products=[],sales=[],clients=[],suppliers=[],finances=[];
function message(t,bad=false){$('status').textContent=t;$('status').className=bad?'error':'good'}
function err(e){alert('Erro: '+(e?.message||e))}
async function query(table){let {data,error}=await client.from(table).select('*').eq('empresa_id',company.id);if(error)throw error;return data||[]}
async function init(){try{let {data,error}=await wait(client.auth.getSession());if(error&&!error.message?.includes('session'))console.log(error.message);user=data?.session?.user||null;await loadCompanies()}catch(e){message(e.message,true)}}
async function loadCompanies(){ $('loginBox').classList.toggle('hide',!!user);$('loggedBox').classList.toggle('hide',!user);if(!user){company=null;$('work').classList.add('hide');$('companyLabel').textContent='Sem empresa';message('Entre ou crie sua conta.');return}
message('Conectado: '+user.email);
const {data,error}=await wait(client.from('cf_empresas').select('id,nome,ramo,tema'));if(error)throw error;companies=data||[];
const select=$('companies');let previous=company?.id||sessionStorage.getItem('cf_active');select.replaceChildren();
companies.forEach(c=>{let o=document.createElement('option');o.value=c.id;o.textContent=c.nome+' — '+c.ramo;select.append(o)});
company=companies.find(c=>c.id===previous)||companies[0]||null;if(company){select.value=company.id;sessionStorage.setItem('cf_active',company.id);await refresh()}else{$('work').classList.add('hide');$('companyLabel').textContent='Crie uma empresa'}
}
async function refresh(){if(!company)return;$('work').classList.remove('hide');$('companyLabel').textContent=company.nome;$('hello').textContent='Bem-vindo à '+company.nome;$('companyInfo').textContent=company.nome+' • '+company.ramo;
try{[products,sales,clients,suppliers,finances]=await Promise.all(['cf_produtos','cf_vendas','cf_clientes','cf_fornecedores','cf_financeiro'].map(query));draw()}catch(e){err(e)}}
function line(target,title,description){let r=document.createElement('div');r.className='line';let a=document.createElement('strong'),b=document.createElement('span');a.textContent=title;b.textContent=description;r.append(a,b);$(target).append(r)}
function clear(id){$(id).replaceChildren()}
function draw(){
$('metricProducts').textContent=products.length;$('metricStock').textContent=products.reduce((a,x)=>a+Number(x.estoque),0);$('metricSales').textContent=fmt(sales.filter(s=>s.status==='concluida').reduce((a,x)=>a+Number(x.total),0));$('metricClients').textContent=clients.length;
['productsList','salesList','clientsList','suppliersList','financeList','saleProduct'].forEach(clear);
products.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).forEach(x=>{line('productsList',x.nome,fmt(x.preco)+' • Estoque: '+x.estoque);if(x.estoque>0){let o=document.createElement('option');o.value=x.id;o.textContent=x.nome+' — '+fmt(x.preco)+' ('+x.estoque+')';$('saleProduct').append(o)}});
sales.sort((a,b)=>b.criada_em.localeCompare(a.criada_em)).slice(0,30).forEach(x=>line('salesList',fmt(x.total),new Date(x.criada_em).toLocaleString('pt-BR')));
clients.forEach(x=>line('clientsList',x.nome,x.whatsapp||'Sem contato'));
suppliers.forEach(x=>line('suppliersList',x.nome,x.contato||'Sem contato'));
finances.sort((a,b)=>b.criado_em.localeCompare(a.criado_em)).forEach(x=>line('financeList',x.descricao,(x.tipo==='entrada'?'+ ':'− ')+fmt(x.valor)+' • '+(x.pago?'Pago':'Pendente')));
const key='cf_photo_'+company.id;let photo=localStorage.getItem(key);document.body.style.setProperty('--photo',photo?'url("'+photo+'")':'linear-gradient(130deg,#12344c,#14283e)');
}
async function insert(table,obj,form){try{if(!company)throw Error('Selecione uma empresa');const {error}=await client.from(table).insert({...obj,empresa_id:company.id});if(error)throw error;form.reset();await refresh();alert('Salvo na nuvem!')}catch(e){err(e)}}
function bindForm(id,table,get){$(id).addEventListener('submit',async e=>{e.preventDefault();await insert(table,get(),e.target)})}
bindForm('productForm','cf_produtos',()=>({nome:$('pName').value.trim(),preco:Number($('pPrice').value),custo:Number($('pCost').value||0),estoque:Number($('pStock').value)}));
bindForm('clientForm','cf_clientes',()=>({nome:$('cName').value.trim(),whatsapp:$('cPhone').value.trim()}));
bindForm('supplierForm','cf_fornecedores',()=>({nome:$('sName').value.trim(),contato:$('sContact').value.trim()}));
bindForm('financeForm','cf_financeiro',()=>({descricao:$('fDescription').value.trim(),tipo:$('fType').value,valor:Number($('fValue').value),vencimento:$('fDate').value||null,pago:$('fPaid').checked}));
$('saleForm').addEventListener('submit',async e=>{e.preventDefault();try{let qty=Number($('saleQty').value);if(!Number.isInteger(qty)||qty<1)throw Error('Quantidade inválida');let {error}=await client.rpc('cf_registrar_venda',{p_empresa:company.id,p_produto:$('saleProduct').value,p_quantidade:qty});if(error)throw error;await refresh();alert('Venda registrada na nuvem e estoque atualizado!')}catch(ex){err(ex)}});
$('loginBtn').onclick=async()=>{try{let {data,error}=await wait(client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));if(error)throw error;user=data.user;message('Autenticado. Carregando empresas...');await loadCompanies()}catch(e){err(e)}};
$('signupBtn').onclick=async()=>{try{let {data,error}=await wait(client.auth.signUp({email:$('email').value.trim(),password:$('password').value}));if(error)throw error;user=data.user;message('Autenticado. Carregando empresas...');await loadCompanies();if(!user)alert('Confirme o cadastro pelo e-mail antes de entrar.')}catch(e){err(e)}};
$('logoutBtn').onclick=async()=>{await client.auth.signOut();user=null;company=null;await loadCompanies()};
$('createCompany').onclick=async()=>{try{let nome=$('newCompany').value.trim();if(!nome)throw Error('Digite o nome');let {error}=await client.from('cf_empresas').insert({nome,ramo:$('newBranch').value,owner_id:user.id});if(error)throw error;$('newCompany').value='';await loadCompanies();alert('Empresa criada na nuvem!')}catch(e){err(e)}};
$('companies').onchange=async()=>{company=companies.find(x=>x.id===$('companies').value);sessionStorage.setItem('cf_active',company.id);await refresh()};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#work section').forEach(s=>s.classList.toggle('hide',s.id!==b.dataset.page));document.querySelectorAll('nav button').forEach(x=>x.className=x===b?'':'alt')});
$('photo').onchange=e=>{let f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type)){alert('Use JPG, PNG ou WebP até 2 MB');return}let reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('cf_photo_'+company.id,reader.result);draw()}catch(ex){alert('Foto grande demais para este navegador')}};reader.readAsDataURL(f)};
$('removePhoto').onclick=()=>{localStorage.removeItem('cf_photo_'+company.id);draw()};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
init();
