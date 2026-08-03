import { MeshBasicMaterial, ShaderMaterial, Texture } from "three";
import { describe, expect, it } from "vitest";

import { applySphereTexture } from "../Renderer.js";

// Renderer 本体は WebGLRenderer の実構築を要するため jsdom では生成できない（tech-stack-decisions.md UoW-A §5）。
// setSphereTexture の実体である applySphereTexture を純粋関数として切り出し、直接検証する。
describe("applySphereTexture", () => {
  it("applies a texture and resets the material color to white (BR-B-09)", () => {
    const material = new MeshBasicMaterial({ color: 0x808080 });
    const texture = new Texture();
    const versionBefore = material.version;

    applySphereTexture(material, texture);

    expect(material.map).toBe(texture);
    expect(material.color.getHex()).toBe(0xffffff);
    // `needsUpdate` は three.js では書き込み専用のセッターのため、`version` の増加で反映を確認する。
    expect(material.version).toBeGreaterThan(versionBefore);
  });

  it("clears the texture and restores the placeholder color when passed null", () => {
    const material = new MeshBasicMaterial({ color: 0xffffff });
    material.map = new Texture();
    const versionBefore = material.version;

    applySphereTexture(material, null);

    expect(material.map).toBeNull();
    expect(material.color.getHex()).toBe(0x808080);
    expect(material.version).toBeGreaterThan(versionBefore);
  });

  // UoW-C: シェーダベースモードの ShaderMaterial はテクスチャを `uniforms.map` で公開する規約
  // （NFR Requirements Q2）。applySphereTexture はマテリアル種別で分岐してこれを更新する。
  it("updates uniforms.map.value for a ShaderMaterial exposing a 'map' uniform (NFR Requirements Q2)", () => {
    const material = new ShaderMaterial({
      uniforms: { map: { value: null } },
      vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
    });
    const texture = new Texture();

    applySphereTexture(material, texture);

    expect(material.uniforms.map?.value).toBe(texture);
  });

  it("does not throw for a ShaderMaterial without a 'map' uniform", () => {
    const material = new ShaderMaterial({
      vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
    });

    expect(() => applySphereTexture(material, new Texture())).not.toThrow();
  });
});
