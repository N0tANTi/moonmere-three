# 月沼白堡 · Moonmere

用 Three.js 重建的月夜水园。十秒镜头从月亮下摇，掠过白堡与水边拱廊，最后停在一朵睡莲前。石雕、树叶、花瓣与水面都由代码生成。

**[四步制作流程与提示词](PROCESS.md)** · **[四张静态参考图](https://github.com/N0tANTi/moonmere-three/releases/tag/v1.0.0)**

![本项目渲染的睡莲池，左侧是透光的花瓣，右侧浮叶之间露出深色水面](https://github.com/N0tANTi/moonmere-three/releases/download/v1.0.0/03-lily-pond.jpg)

## 本地打开最终版

从仓库根目录运行，需 Node.js 22 或更高版本及 npm。

```sh
npm ci --prefix scene/moonmere_three
node scene/moonmere_three/build.mjs --engraved
```

用支持 WebGL 2 的浏览器打开 `output/moonmere_three_engraved/moonmere.html`。拖动进度条到 **5 秒**看白堡石纹，到 **9.3 秒**看睡莲透光与浮叶间的暗水。暂停后点「调色」，可以在同一帧比较林下深影。

## 从哪改起

- 改镜头和受光看 [scene.js](scene/moonmere_three/scene.js)，改林下暗部的色调看 [finish.js](scene/moonmere_three/finish.js)。
- 改白堡和拱廊看 [architecture.js](scene/moonmere_three/architecture.js) 与 [castle-ornament.js](scene/moonmere_three/castle-ornament.js)，改花瓣和浮叶看 [garden.js](scene/moonmere_three/garden.js)。
- 早期的 Blender 场景可独立重建。在装有 Blender 5.2 的环境运行 `blender -b --factory-startup -P scene/build_moonmere.py`，会生成可编辑的 `output/moonmere/moonmere.blend`。[Blender 构建入口](scene/build_moonmere.py)

同一构建命令省略 `--engraved` 可生成 Three.js 第一版，换成 `--refined` 可生成中间的材质版，各版本写入独立目录。Three.js 的许可随构建嵌入页面。[第三方许可](notices/three.txt)
