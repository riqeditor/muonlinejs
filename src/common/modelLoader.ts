import {
  AnimationGroup,
  Bone,
  CustomMaterial,
  PBRBaseSimpleMaterial,
  Scene,
  Skeleton,
  Texture,
  type AbstractMesh,
} from '../libs/babylon/exports';
import type { World } from '../ecs/world';
import { BMD, BMDReader } from './BMD';
import { downloadDataBytesBuffer } from './utils';
import { resolveUrlToDataFolder } from './resolveUrlToDataFolder';
import { createItemMaterial } from './itemMaterial';
import { getEmptyTexture } from '../libs/babylon/emptyTexture';
import { BlendState } from './objects/enum';

const reader = new BMDReader();
const Models: Partial<Record<number, Promise<BMD>>> = {};
const ModelsFactory: Record<number, () => Promise<BMD>> = {};

export async function getModel(modelId: number) {
  if (Models[modelId]) return Models[modelId];

  if (!ModelsFactory[modelId])
    throw new Error(`Model factory for ID ${modelId} not found`);

  Models[modelId] = ModelsFactory[modelId]();
  return Models[modelId];
}

const cache: Partial<Record<string, Promise<BMD>>> = {};

export async function loadBMD(filePath: string): Promise<BMD> {
  if (cache[filePath]) return cache[filePath];

  const dir = filePath.split('/').slice(0, -1).join('/') + '/';

  cache[filePath] = new Promise(async r => {
    try {
      r(reader.read(await downloadDataBytesBuffer(filePath), dir));
    } catch (error) {
      console.error(`Error loading BMD from ${filePath}:`, error);
      throw error;
    }
  });

  return cache[filePath];
}

let skelId = 100;

const materialsCache: Map<string, CustomMaterial> = new Map();

export function getMaterial(
  scene: Scene,
  backFaceCulling: boolean,
  transparencyMode: number,
  alphaMode: BlendState
) {
  const name = `${backFaceCulling}_${transparencyMode}_${BlendState[alphaMode]}`;

  if (materialsCache.has(name)) return materialsCache.get(name)!;

  const material = createItemMaterial(scene);
  material.name = name;
  material.backFaceCulling = backFaceCulling;
  material.transparencyMode = transparencyMode;
  material.useAlphaFromDiffuseTexture = true;
  material.diffuseTexture = getEmptyTexture(scene);
  material.alphaMode = alphaMode;

  material.freeze();

  materialsCache.set(name, material);

  return material;
}

const texturesCache: Map<string, Texture> = new Map();

function getTexture(key: string, fallback: Texture) {
  if (texturesCache.has(key)) return texturesCache.get(key)!;

  fallback.isBlocking = false;
  fallback.updateSamplingMode(Texture.NEAREST_NEAREST);

  texturesCache.set(key, fallback);

  return fallback;
}

/** Tempo máximo esperando texturas (ms): se uma textura falhar, o modelo aparece mesmo assim. */
const TEXTURE_WAIT_TIMEOUT_MS = 8000;

/** thegame: espera todas as texturas ficarem prontas (ou o tempo máximo). */
function waitTexturesReady(textures: Texture[]): Promise<void> {
  const unique = [...new Set(textures)];
  const pending = unique.filter(t => !t.isReady());
  if (pending.length === 0) return Promise.resolve();

  const all = Promise.all(
    pending.map(
      t =>
        new Promise<void>(res => {
          if (t.isReady()) return res();
          t.onLoadObservable.addOnce(() => res());
        })
    )
  ).then(() => undefined);
  const timeout = new Promise<void>(res => setTimeout(res, TEXTURE_WAIT_TIMEOUT_MS));
  return Promise.race([all, timeout]);
}

export async function loadGLTF(filePath: string, world: World) {
  filePath = resolveUrlToDataFolder(filePath);
  const fileName = filePath.split('/').at(-1)!;

  return new Promise<{
    mesh: AbstractMesh;
    skeleton: Skeleton;
    animationGroups: AnimationGroup[];
  }>(resolve => {
    const task = world.assetsManager.addMeshTask(
      fileName,
      undefined,
      filePath,
      ''
    );

    const loadTask = () =>
      task.run(
        world.scene,
        () => {
          task.loadedMeshes[0].name = fileName;

          task.loadedMeshes.forEach(mesh => {
            mesh.metadata ??= {};
            mesh.metadata.itemLvl = 0;
            mesh.metadata.isExcellent = false;
            mesh.metadata.timeOffset = 0;
            mesh.alwaysSelectAsActiveMesh = true;
            mesh.isPickable = false;
            mesh.doNotSyncBoundingInfo = false;

            const m = mesh.material as PBRBaseSimpleMaterial;
            if (m && !!m._albedoTexture) {
              const cached = getTexture(
                fileName + m._albedoTexture.name,
                m._albedoTexture as Texture
              );
              const diffuseTexture = cached;

              const clonedMaterial = getMaterial(
                world.scene,
                m.backFaceCulling,
                m.transparencyMode ?? 0,
                m.alphaMode ?? BlendState.ALPHA_DISABLE
              );
              mesh.visibility = m.alpha;
              mesh.metadata.diffuseTexture = diffuseTexture;

              if (m._albedoTexture !== cached) {
                m._albedoTexture.dispose();
              }
              m._albedoTexture = null;

              mesh.material = clonedMaterial;
              m.dispose(true, false);
            }

            if (mesh.skeleton) {
              mesh.numBoneInfluencers = 1;
            }
          });

          // if (task.loadedAnimationGroups.length > 0) {
          //   task.loadedAnimationGroups[0].play(true);
          // }

          task.loadedSkeletons.forEach(skeleton => {
            skeleton.name = `skeleton_${fileName}`;
          });

          let skeleton = task.loadedSkeletons[0];

          if (
            task.loadedSkeletons.length === 0 &&
            filePath.includes('player.glb')
          ) {
            const s = new Skeleton(
              `skeleton_${fileName}`,
              `skeleton_${fileName}_${skelId++}`,
              world.scene
            );
            skeleton = s;

            const map = new Map<any, Bone>();
            const str: string[] = [];
            const skeletonNodesStartIndex = task.loadedTransformNodes.findIndex(
              n => n.name.startsWith('skin_')
            );

            if (skeletonNodesStartIndex !== -1) {
              const nodes = task.loadedTransformNodes.slice(
                skeletonNodesStartIndex
              );
              for (const node of nodes) {
                str.push(node.name);
                const bone = new Bone(node.name, s, null);
                bone.linkTransformNode(node);
                map.set(node, bone);
                bone.parent = node.parent
                  ? map.get(node.parent!) ?? null
                  : null;
              }
            }

            s.prepare();
          }

          // thegame: o modelo só aparece quando as texturas dele terminam de carregar.
          // Antes ele surgia na hora com a "textura vazia" (branca) e depois trocava.
          const textures = task.loadedMeshes
            .map(mesh => mesh.metadata?.diffuseTexture as Texture | undefined)
            .filter((t): t is Texture => !!t);
          task.loadedMeshes.forEach(mesh => mesh.setEnabled(false));

          waitTexturesReady(textures).then(() => {
            task.loadedMeshes.forEach(mesh => mesh.setEnabled(true));
            resolve({
              mesh: task.loadedMeshes[0]!,
              skeleton,
              animationGroups: task.loadedAnimationGroups,
            });
          });
        },
        () => {
          // wait(2000).finally(() => loadTask());
        }
      );

    loadTask();
  });
}

/**
 * thegame: partes de "efeito" das armas e asas (fogo da Flamberge, brilhos) usam texturas com
 * fundo preto, que o MU original desenha somando à cena (aditivo). Os nomes das texturas se
 * perderam na conversão, então a parte vira aditiva quando a textura é quase toda preta.
 */
const EFFECT_DARK_FRACTION = 0.5;
const effectTextureCache = new Map<Texture, boolean>();

async function isEffectTexture(texture: Texture): Promise<boolean> {
  const cached = effectTextureCache.get(texture);
  if (cached !== undefined) return cached;
  let result = false;
  try {
    const pixels = (await texture.readPixels()) as Uint8Array | null;
    if (pixels && pixels.length >= 4) {
      let dark = 0;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        total++;
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 60) dark++;
      }
      result = dark / total >= EFFECT_DARK_FRACTION;
    }
  } catch {
    result = false;
  }
  effectTextureCache.set(texture, result);
  return result;
}

export async function applyAdditiveToEffectMeshes(scene: Scene, meshes: AbstractMesh[]) {
  await Promise.all(
    meshes.map(async mesh => {
      const texture = mesh.metadata?.diffuseTexture as Texture | undefined;
      if (!texture || !(await isEffectTexture(texture))) return;
      mesh.material = getMaterial(scene, false, 2, BlendState.ALPHA_ADD);
    })
  );
}

/**
 * thegame: alguns .glb convertidos (ex.: Skill/Rider01.glb, a Uniria) têm as imagens embutidas
 * mas sem ligação com os materiais, e aparecem brancos. Lê as imagens soltas de dentro do
 * arquivo e liga a imagem i à parte i do modelo. Não altera o arquivo.
 */
export async function attachLooseGlbImages(scene: Scene, filePath: string, meshes: AbstractMesh[]) {
  if (meshes.every(m => m.metadata?.diffuseTexture)) return;
  try {
    const buffer = (await (await fetch(resolveUrlToDataFolder(filePath))).arrayBuffer()) as ArrayBuffer;
    const view = new DataView(buffer);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
    if (!json.images?.length || json.textures?.length) return;
    const binStart = 20 + jsonLength + 8;
    const textures = json.images.map((image: { bufferView?: number; mimeType?: string; name?: string }, i: number) => {
      let url: string;
      if (image.bufferView === undefined) {
        // Imagem sem dados (a conversão original não achou a textura): usa o arquivo
        // convertido à parte com o mesmo nome (ex.: Skill/unicon.webp, fora do Git).
        url = resolveUrlToDataFolder(`${image.name ?? ''}.webp`);
      } else {
        const bv = json.bufferViews[image.bufferView];
        const bytes = new Uint8Array(buffer, binStart + (bv.byteOffset ?? 0), bv.byteLength);
        url = URL.createObjectURL(new Blob([bytes], { type: image.mimeType ?? 'image/webp' }));
      }
      const texture = new Texture(url, scene, false, false, Texture.NEAREST_NEAREST);
      texture.name = `${filePath}#${i}`;
      texture.hasAlpha = true;
      return texture;
    });
    meshes.forEach((mesh, i) => {
      if (mesh.metadata?.diffuseTexture) return;
      const texture = textures[Math.min(i, textures.length - 1)];
      mesh.metadata ??= {};
      mesh.metadata.diffuseTexture = texture;
      // Sem textura no arquivo, a parte ficou com o material padrão do .glb (branco):
      // troca pelo material do jogo, que desenha a textura guardada em metadata.
      mesh.material = getMaterial(scene, false, 0, BlendState.ALPHA_DISABLE);
    });
  } catch (e) {
    console.warn(`não foi possível ler as imagens de ${filePath}`, e);
  }
}
