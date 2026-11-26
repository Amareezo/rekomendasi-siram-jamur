// ===== Konfigurasi (ubah di sini saat validasi pakar) =====
const CFG={
  suhu:{rendah:22,idealMax:28,panas:32},
  rh:{ideal:80,idealMax:90,krisRendah:70,krisTinggi:95},
  jam:{pagi:'pagi (06.00–08.00)',siang:'tengah hari (12.00–13.00)'}
};
const S=CFG.suhu,H=CFG.rh;
const nonPanas=f=>f.kat_suhu&&f.kat_suhu!=='panas';

// ===== Knowledge base: tiap aturan punya id, kondisi (if), fakta baru (then), keterangan (t) =====
const R=[
 {id:'S1',if:f=>f.suhu<S.rendah,then:{kat_suhu:'rendah'},t:`Suhu < ${S.rendah} °C → suhu rendah`},
 {id:'S2',if:f=>f.suhu>=S.rendah&&f.suhu<=S.idealMax,then:{kat_suhu:'ideal'},t:`Suhu ${S.rendah}–${S.idealMax} °C → suhu ideal`},
 {id:'S3',if:f=>f.suhu>S.idealMax&&f.suhu<S.panas,then:{kat_suhu:'hangat'},t:`Suhu > ${S.idealMax} dan < ${S.panas} °C → suhu hangat`},
 {id:'S4',if:f=>f.suhu>=S.panas,then:{kat_suhu:'panas'},t:`Suhu ≥ ${S.panas} °C → suhu panas`},
 {id:'H1',if:f=>f.rh<H.ideal,then:{kat_rh:'rendah'},t:`RH < ${H.ideal}% → kelembapan rendah`},
 {id:'H2',if:f=>f.rh>=H.ideal&&f.rh<=H.idealMax,then:{kat_rh:'ideal'},t:`RH ${H.ideal}–${H.idealMax}% → kelembapan ideal`},
 {id:'H3',if:f=>f.rh>H.idealMax,then:{kat_rh:'tinggi'},t:`RH > ${H.idealMax}% → kelembapan tinggi`},
 {id:'Z1',if:f=>f.rh<H.krisRendah,then:{rh_kritis:'rendah'},t:`RH < ${H.krisRendah}% → zona kritis`},
 {id:'Z2',if:f=>f.rh>=H.krisTinggi,then:{rh_kritis:'tinggi'},t:`RH ≥ ${H.krisTinggi}% → zona kritis`},
 {id:'Z3',if:f=>f.suhu>=S.panas,then:{suhu_kritis:'panas'},t:`Suhu ≥ ${S.panas} °C → zona kritis`},
 {id:'D1',if:f=>f.kat_rh==='tinggi',then:{siram:'tidak'},t:'RH tinggi → tidak perlu siram'},
 {id:'D2',if:f=>f.kat_rh==='ideal'&&nonPanas(f),then:{siram:'tidak'},t:'RH ideal dan suhu tidak panas → tidak perlu siram'},
 {id:'D3',if:f=>f.kat_rh==='ideal'&&f.kat_suhu==='panas',then:{siram:'sedikit'},t:'RH ideal dan suhu panas → siram sedikit'},
 {id:'D4',if:f=>f.kat_rh==='rendah'&&f.rh>=H.krisRendah&&nonPanas(f),then:{siram:'sedikit'},t:'RH rendah dan suhu tidak panas → siram sedikit'},
 {id:'D5',if:f=>f.kat_rh==='rendah'&&f.kat_suhu==='panas',then:{siram:'banyak'},t:'RH rendah dan suhu panas → siram banyak'},
 {id:'D6',if:f=>f.rh_kritis==='rendah'&&nonPanas(f),then:{siram:'banyak'},t:'RH di zona kritis rendah → naik ke siram banyak'},
 {id:'J1',if:f=>f.siram==='tidak',then:{jam:[]},t:'Tidak siram → tanpa jadwal'},
 {id:'J2',if:f=>f.siram==='sedikit'&&(f.kat_suhu==='rendah'||f.kat_suhu==='panas'),then:{jam:['siang']},t:'Siram sedikit karena suhu rendah/panas → tengah hari'},
 {id:'J3',if:f=>f.siram==='sedikit'&&(f.kat_suhu==='ideal'||f.kat_suhu==='hangat'),then:{jam:['pagi']},t:'Siram sedikit karena RH rendah → pagi'},
 {id:'J4',if:f=>f.siram==='banyak',then:{jam:['pagi','siang']},t:'Siram banyak → pagi dan tengah hari'},
 {id:'T1',if:f=>f.siram==='banyak'||f.suhu_kritis||f.rh_kritis,then:{status:'Tindakan Segera'},t:'Siram banyak atau zona kritis → Tindakan Segera'},
 {id:'T2',if:f=>f.siram==='sedikit'&&!f.suhu_kritis&&!f.rh_kritis,then:{status:'Perhatian'},t:'Siram sedikit tanpa zona kritis → Perhatian'},
 {id:'T3',if:f=>f.siram==='tidak'&&!f.suhu_kritis&&!f.rh_kritis,then:{status:'Aman'},t:'Tidak siram tanpa zona kritis → Aman'}
];

// ===== Inference engine: forward chaining, tiap iterasi mengevaluasi aturan terhadap snapshot fakta =====
function infer(input){
  const f={...input},fired=new Set(),trace=[];
  for(let it=1;it<=10;it++){
    const snap={...f},hit=[];
    for(const r of R){
      if(fired.has(r.id)||Object.keys(r.then).every(k=>k in f))continue;
      if(r.if(snap))hit.push(r);
    }
    if(!hit.length)break;
    hit.forEach(r=>{Object.assign(f,r.then);fired.add(r.id)});
    trace.push({it,hit});
  }
  return{f,trace};
}

// ===== Alasan berbasis sumber =====
function alasan(f){
  const a=[];
  ({panas:`Suhu ≥ ${S.panas} °C: jamur menjadi keras dan menguning (Padil dkk., 2024; Rusjayanti).`,
    rendah:`Suhu < ${S.rendah} °C di bawah rentang ideal ${S.rendah}–${S.idealMax} °C (Juknis 3.5.14). Suhu rendah berisiko membuat jamur busuk (Rusjayanti dalam Padil dkk., 2024).`,
    hangat:`Suhu sedikit di atas ${S.idealMax} °C: masih ditoleransi (pita toleransi tim).`,
    ideal:`Suhu dalam rentang ideal ${S.rendah}–${S.idealMax} °C (Juknis 3.5.14).`}[f.kat_suhu]||'').split('\n').forEach(x=>x&&a.push(x));
  if(f.kat_rh==='rendah')a.push(`RH < ${H.ideal}%: di bawah rentang ${H.ideal}–${H.idealMax}% (Juknis; Waluyo). Kurang lembap membuat pinhead mati dan substrat mengering (Juknis 3.5.10, 3.5.14).`);
  if(f.rh_kritis==='rendah')a.push(`RH < ${H.krisRendah}%: miselium berisiko dehidrasi dan tubuh buah terlambat terbentuk (Padil dkk., 2024).`);
  if(f.kat_rh==='ideal')a.push(`RH dalam rentang ideal ${H.ideal}–${H.idealMax}%.`);
  if(f.kat_rh==='tinggi')a.push(`RH > ${H.idealMax}%: kelembapan sudah cukup, menyiram menambah risiko jamur basah (Juknis 3.5.10).`);
  if(f.rh_kritis==='tinggi')a.push(`RH ≥ ${H.krisTinggi}%: air berlebih memicu mikroba pesaing (Padil dkk., 2024). Jangan menyiram.`);
  return a;
}

// ===== UI =====
const $=id=>document.getElementById(id);
const fmt=n=>n.toLocaleString('id-ID',{maximumFractionDigits:1});
const PRESET=[
  ['Ideal 27 °C / 82%',27,82],['29 °C / 85%',29,85],['32 °C / 70%',32,70],
  ['Suhu rendah 20 °C / 85%',20,85],['RH kritis 27 °C / 68%',27,68],
  ['RH berlebih 27 °C / 96%',27,96],['Panas 33 °C / 82%',33,82]
];
PRESET.forEach(([l,s,h])=>{
  const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=l;
  b.onclick=()=>{$('suhu').value=s;$('rh').value=h;analyze()};
  $('chips').appendChild(b);
});
function kosong(){
  $('out').innerHTML='<div class="verdict kosong"><p class="st">Belum ada hasil</p><p class="big">Isi suhu dan kelembapan</p><p class="det">Lalu tekan Analisis, atau pilih salah satu skenario uji.</p></div>';
}
function fail(m){$('err').textContent=m;kosong()}
function analyze(){
  $('err').textContent='';
  const s=$('suhu').value.trim().replace(',','.'),h=$('rh').value.trim().replace(',','.');
  if(s===''||h==='')return fail('Isi suhu dan kelembapan terlebih dahulu.');
  const suhu=Number(s),rh=Number(h);
  if(!isFinite(suhu)||!isFinite(rh))return fail('Suhu dan kelembapan harus berupa angka.');
  if(suhu<0||suhu>50)return fail('Suhu harus berada di antara 0 dan 50 °C.');
  if(rh<0||rh>100)return fail('Kelembapan harus berada di antara 0 dan 100%.');
  render(suhu,rh);
}
function render(suhu,rh){
  const{f,trace}=infer({suhu,rh});
  const cls={'Aman':'','Perhatian':'perhatian','Tindakan Segera':'segera'}[f.status];
  const jam=f.jam.map(j=>CFG.jam[j]).join(' dan ');
  const big={tidak:'Tidak perlu disiram',sedikit:'Siram sedikit',banyak:'Siram banyak'}[f.siram];
  const det=f.siram==='tidak'?(f.rh_kritis==='tinggi'?'Kelembapan berlebih: jangan menyiram.':'Kondisi kumbung tidak memerlukan penyiraman hari ini.'):
    `Jadwal: ${jam}.`+(f.siram==='banyak'?' Dua sesi penyiraman.':' Satu sesi penyiraman ringan.');
  const krit=[f.suhu_kritis&&`suhu ≥ ${S.panas} °C`,f.rh_kritis==='rendah'&&`RH < ${H.krisRendah}%`,f.rh_kritis==='tinggi'&&`RH ≥ ${H.krisTinggi}%`].filter(Boolean).join(', ')||'tidak ada';
  const fired=trace.flatMap(t=>t.hit);
  $('out').innerHTML=`
  <div class="verdict ${cls}"><p class="st">Status: ${f.status}</p><p class="big">${big}</p><p class="det">${det}</p></div>
  <div class="two">
    <div class="card"><h2>Fakta yang terbentuk</h2><table>
      <tr><th>Suhu</th><td>${fmt(suhu)} °C (${f.kat_suhu})</td></tr>
      <tr><th>Kelembapan</th><td>${fmt(rh)}% (${f.kat_rh})</td></tr>
      <tr><th>Zona kritis</th><td>${krit}</td></tr>
      <tr><th>Kode aturan</th><td>${fired.map(r=>r.id).join(', ')}</td></tr></table></div>
    <div class="card"><h2>Alasan</h2><ul>${alasan(f).map(x=>`<li>${x}</li>`).join('')}</ul></div>
  </div>
  <div class="card"><h2>Jejak forward chaining</h2><table>
    <tr><th>Iterasi</th><th>Aturan yang aktif</th></tr>
    ${trace.map(t=>`<tr><td>${t.it}</td><td>${t.hit.map(r=>`<b>${r.id}</b>: ${r.t}`).join('<br>')}</td></tr>`).join('')}
  </table></div>`;
}
$('go').onclick=analyze;
['suhu','rh'].forEach(i=>$(i).addEventListener('keydown',e=>{if(e.key==='Enter')analyze()}));
kosong();
