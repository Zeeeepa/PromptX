---
"@promptx/desktop": patch
---

fix(desktop): 修复 macOS 应用图标尺寸和显示问题

- 为图标添加 15% 边距，解决 Launchpad 中图标过大的问题
- 重新生成 icns 文件，修复 Dock 栏中图标显示为正方形的问题
- 更新所有尺寸变体（16x16 到 1024x1024）
- macOS 现在会正确应用圆角效果
