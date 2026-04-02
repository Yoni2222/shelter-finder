async function t(q) {
  const g = await (await fetch('http://localhost:3002/api/geocode?q='+encodeURIComponent(q))).json();
  const arr = Array.isArray(g) ? g : [g];
  if (arr.length === 0 || !arr[0].lat) { console.log(q+' => GEOCODE FAIL'); return; }
  const s = await (await fetch('http://localhost:3002/api/shelters?lat='+arr[0].lat+'&lon='+arr[0].lon+'&q='+encodeURIComponent(q))).json();
  const sh = s.shelters || [];
  console.log(q+' => '+sh.length+' shelters, nearest: '+(sh[0] ? sh[0].address+' '+Math.round(sh[0].dist*1000)+'m' : 'none'));
}
(async()=>{
  await t('דיזראעלי 5 לוד');
  await t('הרקפות 3 לוד');
  await t('קני סוף 13 לוד');
  await t('איינשטיין 10 לוד');
})();
