import {
  CreatePlane,
  RawTexture,
  StandardMaterial,
  Texture,
  Vector3,
} from '../babylon/exports';
import { CreateGroundFromHeightMap } from './customGroundMesh';
import { createTerrainMaterial } from './terrainMaterial';
import { ENUM_WORLD } from '../../common';
import {
  downloadDataBytesBuffer,
  isFlagInBinaryMask,
  readOJZBufferAsJPEGBuffer,
} from '../../common/utils';
import { parseTerrainAttribute } from '../../common/terrain/parseTerrainAttribute';
import { parseTerrainHeight } from '../../common/terrain/parseTerrainHeight';
import { parseTerrainMapping } from '../../common/terrain/parseTerrainMapping';
import { parseTerrainLight } from '../../common/terrain/parseTerrainLight';
import { getTilesList } from '../../common/terrain/getTilesList';
import {
  SpecialHeight,
  TERRAIN_SIZE,
  TERRAIN_SIZE_MASK,
  TWFlags,
} from '../../common/terrain/consts';
import { parseTerrainObjects } from '../../common/terrain/parseTerrainObjects';
import { World } from '../../ecs/world';
import { DEBUG_SHOW_TERRAIN_ATTRIBUTES } from '../../consts';

function GetTerrainIndex(x: number, y: number) {
  return ~~(~~y * TERRAIN_SIZE + ~~x);
}

export async function getTerrainData(world: World, map: ENUM_WORLD) {
  const scene = world.scene;
  const worldNum = map + 1;
  const worldFolder = `World${worldNum}/`;

  const terrainAttributeBytes = await downloadDataBytesBuffer(
    `${worldFolder}EncTerrain${worldNum}.att`
  );
  const terrainHeightBytes = await downloadDataBytesBuffer(
    `${worldFolder}TerrainHeight.OZB`
  );
  const terrainMappingBytes = await downloadDataBytesBuffer(
    `${worldFolder}EncTerrain${worldNum}.map`
  );
  const terrainLightBytes = await downloadDataBytesBuffer(
    `${worldFolder}TerrainLight.OZJ`
  );

  const terrainHeight = await parseTerrainHeight(terrainHeightBytes);
  const terrainAttrs = await parseTerrainAttribute(terrainAttributeBytes, map);
  const terrainMapping = await parseTerrainMapping(terrainMappingBytes);

  const lightTextureData = await readOJZBufferAsJPEGBuffer(
    scene,
    `${worldFolder}TerrainLight.OZJ`,
    terrainLightBytes
  );

  const terrainLight = await parseTerrainLight(
    lightTextureData.BufferFloat,
    terrainHeight
  );

  const textureNames = getTilesList(map);

  const terrainTextures = (
    await Promise.all(
      textureNames.map(async (t, i) => {
        // thegame: alguns mapas não têm todas as texturas da lista (ex.: Arena/World7 não tem
        // TileGround01). Sem o arquivo, o servidor de arquivos devolve uma página HTML e o
        // carregamento travava. Nesse caso usa uma textura parecida que exista na pasta.
        const candidates = [t, t.replace(/\d+$/, n => String(Number(n) + 1).padStart(n.length, '0')), 'TileGround02', 'TileGrass01'];
        let filePath = `World${worldNum}/${t}.OZJ`;
        let ozjBytes: Awaited<ReturnType<typeof downloadDataBytesBuffer>> | null = null;
        for (const name of candidates) {
          filePath = `World${worldNum}/${name}.OZJ`;
          try {
            const bytes = await downloadDataBytesBuffer(filePath);
            const first = bytes.byteLength > 0 ? new Uint8Array(bytes.buffer, bytes.byteOffset, 1)[0] : 0;
            if (bytes.byteLength > 0 && first !== 0x3c /* '<' = HTML */) {
              ozjBytes = bytes;
              break;
            }
          } catch {
            // tenta a próxima
          }
          console.warn(`textura do terreno ausente: ${filePath}`);
        }
        if (!ozjBytes) throw new Error(`Nenhuma textura encontrada para ${t} em World${worldNum}`);

        return readOJZBufferAsJPEGBuffer(
          scene,
          filePath.replace('.', `_${i}.`),
          ozjBytes
        );
      })
    )
  ).map(t => t.Texture);

  const objsBuffer = await downloadDataBytesBuffer(
    `World${worldNum}/EncTerrain${worldNum}.obj`
  );
  const objects = parseTerrainObjects(objsBuffer);

  const terrain = CreateGroundFromHeightMap(
    '_world_' + worldNum,
    scene,
    terrainHeight,
    terrainMapping.layer1,
    terrainMapping.layer2,
    terrainMapping.alpha,
    terrainLight,
    terrainAttrs,
    Vector3.One().setAll(0.25)
  );
  terrain.isPickable = true;

  terrain.metadata = {
    terrain: true,
  };

  const texturesData = terrainTextures.map(texture => {
    const size = texture.getSize().height;
    let scale = size;
    if (scale === 256) {
      scale /= 4;
    }
    return { texture, scale };
  });

  terrain.material = createTerrainMaterial(
    scene,
    { name: 'TerrainMaterial' },
    {
      texturesData,
    }
  );

  if (DEBUG_SHOW_TERRAIN_ATTRIBUTES) {
    const plane = CreatePlane('_terrainPlane', { size: 256 }, scene);
    plane.isPickable = false;
    plane.position.set(128 + 0.5, 128 - 0.5, 1.68);
    plane.rotationQuaternion = null;
    plane.rotation.y = Math.PI;
    const planeMat = new StandardMaterial('_terrainPlaneMat', scene);
    planeMat.disableLighting = true;
    planeMat.specularColor.set(0, 0, 0);
    plane.material = planeMat;
    const pixels = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < TERRAIN_SIZE; i++) {
      for (let j = 0; j < TERRAIN_SIZE; j++) {
        const ind = i * TERRAIN_SIZE + j;

        const index =
          ((TERRAIN_SIZE - i) * TERRAIN_SIZE + (TERRAIN_SIZE - j)) * 4;

        const attr = terrainAttrs[ind];
        pixels[index + 0] = attr & TWFlags.NoMove ? 255 : 0;
        pixels[index + 1] = attr & TWFlags.SafeZone ? 255 : 0; // Layer2
        // pixels[index + 2] = (attr & TWFlags.Water) ? 255 : 0; // Layer3
        // pixels[index + 3] = (attr & TWFlags.Layer4) ? 255 : 0; // Layer4
      }
    }

    planeMat.transparencyMode = 2;
    planeMat.alpha = 0.5;
    planeMat.emissiveTexture = RawTexture.CreateRGBATexture(
      pixels,
      256,
      256,
      scene,
      false,
      false,
      Texture.NEAREST_NEAREST
    );
  }

  function RequestTerrainFlag(xf: number, yf: number) {
    if (xf < 0 || yf < 0) return 0;

    const xi = ~~xf;
    const yi = ~~yf;

    return terrainAttrs[GetTerrainIndex(xi, yi)];
  }

  function RequestTerrainHeight(xf: number, yf: number) {
    if (xf < 0 || yf < 0) return 0;

    // xf /= TERRAIN_SCALE;
    // yf /= TERRAIN_SCALE;

    const xi = ~~xf;
    const yi = ~~yf;

    const index = GetTerrainIndex(xi, yi);

    // If flagged as special height, return SpecialHeight
    // if (
    //   index < terrainAttrs.length &&
    //   isFlagInBinaryMask(terrainAttrs[index], TWFlags.Height)
    // ) {
    //   return SpecialHeight;
    // }

    // Bilinear interpolation of height
    const xd = xf - xi;
    const yd = yf - yi;

    const x1 = xi & TERRAIN_SIZE_MASK,
      y1 = yi & TERRAIN_SIZE_MASK;
    const x2 = (xi + 1) & TERRAIN_SIZE_MASK,
      y2 = (yi + 1) & TERRAIN_SIZE_MASK;

    const i1 = y1 * TERRAIN_SIZE + x1;
    const i2 = y1 * TERRAIN_SIZE + x2;
    const i3 = y2 * TERRAIN_SIZE + x2;
    const i4 = y2 * TERRAIN_SIZE + x1;

    const h1 = terrainHeight[i1];
    const h2 = terrainHeight[i2];
    const h3 = terrainHeight[i3];
    const h4 = terrainHeight[i4];

    return (
      (1 - xd) * (1 - yd) * h1 +
      xd * (1 - yd) * h2 +
      xd * yd * h3 +
      (1 - xd) * yd * h4
    );
  }

  function IsWalkable(x: number, y: number) {
    const terrainFlag = RequestTerrainFlag(x, y);
    return (
      !isFlagInBinaryMask(terrainFlag, TWFlags.NoMove) &&
      !isFlagInBinaryMask(terrainFlag, TWFlags.NoGround)
    );
  }

  function GetTerrainTile(x: number, y: number) {
    if (x < 0 || y < 0) return 0;

    const xi = ~~x;
    const yi = ~~y;

    return terrainMapping.layer1[GetTerrainIndex(xi, yi)];
  }

  return {
    objects,
    terrain,
    terrainHeight,
    RequestTerrainHeight,
    IsWalkable,
    RequestTerrainFlag,
    GetTerrainTile,
  };
}
