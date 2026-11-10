async function testChannels() {
  const testIds = [
    { name: 'Film+', id: 'onlinestream-live-6150' },
    { name: 'Spektrum', id: 'onlinestream-live-6749' },
    { name: 'Minimax', id: 'onlinestream-live-7079' },
    { name: 'Debrecen TV', id: 'onlinestream-live-4247' },
    { name: 'Sopron TV', id: 'onlinestream-live-5982' },
    { name: 'TV2', id: 'onlinestream-live-6143' }
  ];

  for (const item of testIds) {
    try {
      const res = await fetch(`http://localhost:7000/stream/movie/${item.id}.json`);
      const data = await res.json();
      console.log(`\n=== ${item.name} (${item.id}) ===`);
      console.log(`Stream count: ${data?.streams?.length || 0}`);
      if (data?.streams?.length > 0) {
        data.streams.slice(0, 3).forEach((s, idx) => {
          console.log(`  ${idx + 1}. ${s.name} -> ${s.url.slice(0, 70)}`);
        });
      } else {
        console.log('  ❌ NO STREAMS');
      }
    } catch (err) {
      console.error(`Error for ${item.name}:`, err.message);
    }
  }
}
testChannels();
