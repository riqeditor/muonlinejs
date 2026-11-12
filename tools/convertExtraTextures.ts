// thegame: converte texturas que faltam nos .glb herdados, a partir do cliente original.
// O cliente original fica em ../Data (fora do Git; cada um usa a sua cópia). A saída vai para
// public/game-assets e também fica fora do Git (.gitignore).
// Uso: bun tools/convertExtraTextures.ts
import sharp from 'sharp';
import { decodeTga } from '@lunapaint/tga-codec';

const SOURCE = '../Data/';
const TARGET = 'public/game-assets/';

/** [arquivo de origem, destino sem extensão]. OZJ = JPEG com 24 bytes de cabeçalho; OZT = TGA com 4. */
const TEXTURES: [string, string][] = [
  ['Item/unicon.OZJ', 'Skill/unicon'], // Uniria (Skill/Rider01.glb)
  ['Item/unicon01.OZT', 'Skill/unicon01'],
];

for (const [from, to] of TEXTURES) {
  const bytes = new Uint8Array(await Bun.file(SOURCE + from).arrayBuffer());
  let webp: Buffer;
  if (from.toUpperCase().endsWith('.OZJ')) {
    webp = await sharp(bytes.slice(24)).webp().toBuffer();
  } else {
    const tga = await decodeTga(bytes.slice(4));
    webp = await sharp(Buffer.from(tga.image.data), {
      raw: { width: tga.image.width, height: tga.image.height, channels: 4 },
    })
      .webp()
      .toBuffer();
  }
  await Bun.write(`${TARGET}${to}.webp`, new Uint8Array(webp));
  console.log(`${from} -> ${to}.webp`);
}
