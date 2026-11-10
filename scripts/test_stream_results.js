const { getOnlineStreamStreams } = require('../src/scrapers/onlinestream');

async function test() {
  console.log('Testing M1:');
  const m1 = await getOnlineStreamStreams('mediaklikk-live-m1');
  console.log('M1 stream count:', m1.length);
  m1.forEach((s, i) => console.log('  ' + (i+1) + '. ' + s.name + ' -> ' + s.url.slice(0, 75)));

  console.log('\nTesting RTL:');
  const rtl = await getOnlineStreamStreams('onlinestream-live-6141');
  console.log('RTL stream count:', rtl.length);
  rtl.forEach((s, i) => console.log('  ' + (i+1) + '. ' + s.name + ' -> ' + s.url.slice(0, 75)));

  console.log('\nTesting Hír TV:');
  const hirtv = await getOnlineStreamStreams('onlinestream-live-4740');
  console.log('Hír TV stream count:', hirtv.length);
  hirtv.forEach((s, i) => console.log('  ' + (i+1) + '. ' + s.name + ' -> ' + s.url.slice(0, 75)));
}
test();
