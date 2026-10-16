const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const files = [
  'featured_real_gameplay',
  'real_app_main_menu',
  'real_hud_master_league',
  'real_hud_ultra_league'
];

files.forEach(name => {
  const svgPath = path.join('docs', 'screenshots', `${name}.svg`);
  const pngPath = path.join('docs', 'screenshots', `${name}.png`);
  if (fs.existsSync(svgPath)) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
    const pngBuffer = resvg.render().asPng();
    fs.writeFileSync(pngPath, pngBuffer);
    console.log(`Rendered ${pngPath} (${pngBuffer.length} bytes)`);
  }
});
