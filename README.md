# 月沼白堡 · Moonmere

一座用 Three.js 实时渲染的月夜水园。近处的睡莲与浮叶围出深色水面，水边的三联拱廊把视线引向远处的白堡。石雕、树叶、花瓣和水面都由代码生成。

**[场景制作流程与四条详细提示词](PROCESS.md)** · **[四张静态参考图](https://github.com/N0tANTi/moonmere-three/releases/tag/v1.0.0)**

![本项目渲染的睡莲池，左侧是透光的花瓣，右侧浮叶之间露出深色水面](https://github.com/N0tANTi/moonmere-three/releases/download/v1.0.0/03-lily-pond.jpg)

## 本地打开最终版

从仓库根目录运行，需 Node.js 22 或更高版本及 npm。

```sh
npm ci --prefix scene/moonmere_three
node scene/moonmere_three/build.mjs --engraved
```

用支持 WebGL 2 的浏览器打开 `output/moonmere_three_engraved/moonmere.html`。拖动进度条选择白堡全景或池边近景，拖动画面可转动视角。暂停后点「调色」，比较同一视角下的受光叶簇和林下深影。

## 从哪改起

- 调整观察位置、视角和灯光看 [scene.js](scene/moonmere_three/scene.js)，改变树冠暗部与整体色调看 [finish.js](scene/moonmere_three/finish.js)。
- 改白堡和拱廊看 [architecture.js](scene/moonmere_three/architecture.js) 与 [castle-ornament.js](scene/moonmere_three/castle-ornament.js)，改花瓣和浮叶看 [garden.js](scene/moonmere_three/garden.js)。
- 调整池面的倒影和波纹看 [water.js](scene/moonmere_three/water.js)。
- 早期的 Blender 场景可独立重建。在装有 Blender 5.2 的环境运行 `blender -b --factory-startup -P scene/build_moonmere.py`，会生成可编辑的 `output/moonmere/moonmere.blend`。[Blender 构建入口](scene/build_moonmere.py)

同一构建命令省略 `--engraved` 可生成 Three.js 第一版，换成 `--refined` 可生成中间的材质版，各版本写入独立目录。Three.js 的许可随构建嵌入页面。[第三方许可](notices/three.txt)
